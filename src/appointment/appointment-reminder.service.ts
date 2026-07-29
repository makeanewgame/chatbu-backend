import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';

// Per-minute cron granularity. An offset target is treated as "due" if
// the calculated target time is within ±30 seconds of `now`. Because the
// cron fires once per minute, that window ensures every scheduled slot
// gets exactly one dispatch attempt — narrower (e.g. ±10s) risks missing
// slots whose target fell in a minute where the cron ran late; wider
// (e.g. ±90s) risks double-firing across two adjacent ticks. The state
// map (`reminderStates`) is the belt against a double-fire regardless.
const DUE_WINDOW_MS = 30 * 1000;

// Cap the scan window so PG never has to iterate every appointment ever
// booked. Anything more than 25 hours in the future can't have a 24h
// offset that's due yet, and shorter offsets are handled on their own
// ticks. 25*60 = 1500 minutes: 1440 (24h) + 60 (safety margin for late
// cron ticks).
const SCAN_WINDOW_MINUTES = 25 * 60;

type ReminderState = 'sent' | 'failed';

@Injectable()
export class AppointmentReminderService {
    private readonly logger = new Logger(AppointmentReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sms: SmsService,
    ) { }

    /**
     * Scan upcoming appointments once per minute and dispatch reminder
     * SMS for any offset whose target time has arrived.
     *
     * Idempotency lives in the appointment's `reminderStates` JSON:
     * on every dispatch attempt we write the offset key with `sent` or
     * `failed`. A future tick sees the existing key and skips. `failed`
     * means we already tried and the SMS provider rejected — we do NOT
     * retry (unbounded retry against a real provider outage would
     * multiply the outage cost). Owner can re-schedule manually or wait
     * for the next appointment.
     *
     * Bot-level opt-out: `CustomerBots.appointmentReminderOffsets` is
     * an Int[]. Empty array => no reminders. Two default values (1440,
     * 60) match the two FE checkboxes exposed in the bot settings.
     */
    @Cron('* * * * *')
    async dispatchDueReminders(): Promise<void> {
        const now = new Date();
        const scanCeiling = new Date(now.getTime() + SCAN_WINDOW_MINUTES * 60 * 1000);

        const upcoming = await this.prisma.appointment.findMany({
            where: {
                startAt: { gt: now, lt: scanCeiling },
            },
            include: {
                bot: {
                    select: {
                        botName: true,
                        appointmentReminderOffsets: true,
                    },
                },
            },
        });

        if (upcoming.length === 0) {
            return;
        }

        // Per-tick counter for the log line — helps distinguish "quiet
        // cron doing nothing" from "cron ran but every candidate was
        // already handled" from "cron actually did N sends this minute".
        let dispatched = 0;

        for (const appt of upcoming) {
            const offsets = appt.bot?.appointmentReminderOffsets ?? [];
            if (offsets.length === 0) {
                continue;
            }
            const states = (appt.reminderStates as Record<string, ReminderState>) ?? {};

            for (const offsetMinutes of offsets) {
                const key = String(offsetMinutes);
                if (states[key]) {
                    // Already `sent` or `failed` — never retry either.
                    continue;
                }
                const targetTime = appt.startAt.getTime() - offsetMinutes * 60 * 1000;
                const delta = Math.abs(targetTime - now.getTime());
                if (delta > DUE_WINDOW_MS) {
                    continue;
                }

                const outcome = await this.dispatchOne(appt, offsetMinutes);
                await this.recordOutcome(appt.id, states, key, outcome);
                if (outcome === 'sent') {
                    dispatched += 1;
                }
            }
        }

        if (dispatched > 0) {
            this.logger.log(
                `Reminder cron dispatched ${dispatched} SMS this minute across ${upcoming.length} upcoming appointments`,
            );
        }
    }

    /**
     * Send one reminder SMS. Wraps SmsService.sendBookingReminderSms in a
     * try/catch so a NETGSM outage on ONE reminder can't crash the whole
     * per-minute tick and starve every other pending dispatch. Returns
     * 'sent' | 'failed' so the caller can write the outcome to the state
     * map; 'failed' is terminal (no retry) — see class docstring.
     */
    private async dispatchOne(
        appt: {
            id: string;
            attendeePhone: string;
            startAt: Date;
            summary: string;
            timezone: string;
            calendarEventId: string;
            bot: { botName: string | null } | null;
        },
        offsetMinutes: number,
    ): Promise<ReminderState> {
        const botName = appt.bot?.botName ?? 'our team';
        // Language selection here matches AppointmentService.createFromMcp
        // (Faz D) — Turkish default, matching the vast majority of tenant
        // traffic. Per-visitor language is not currently persisted on
        // Appointment; that's a Faz F extension when we add multi-country
        // support.
        try {
            await this.sms.sendBookingReminderSms(
                appt.attendeePhone,
                botName,
                appt.startAt,
                appt.summary,
                offsetMinutes,
                'tr',
                appt.timezone,
            );
            return 'sent';
        } catch (e) {
            this.logger.warn(
                `Reminder SMS failed for appointment ${appt.id} event=${appt.calendarEventId} offset=${offsetMinutes}m: ${e}`,
            );
            return 'failed';
        }
    }

    /**
     * Persist the per-offset dispatch outcome on the Appointment row.
     * Serialized as `{ "1440": "sent", "60": "pending" }` — Prisma's
     * JSON write is atomic per row, but we read+merge+write here rather
     * than an in-place patch because the JSON column doesn't support
     * partial updates through the Prisma client. Concurrency risk is
     * tiny: only one cron replica should be scheduling these (Nest
     * `@Cron` fires per pod, so this is a follow-up if we ever scale
     * the backend beyond one replica — Faz F backlog).
     */
    private async recordOutcome(
        appointmentId: string,
        currentStates: Record<string, ReminderState>,
        offsetKey: string,
        outcome: ReminderState,
    ): Promise<void> {
        const next = { ...currentStates, [offsetKey]: outcome };
        try {
            await this.prisma.appointment.update({
                where: { id: appointmentId },
                data: { reminderStates: next },
            });
        } catch (e) {
            // A write failure here is bad — it means the next tick will
            // re-fire the SMS because the state won't reflect the
            // successful send. Log loudly; alertmanager can page on
            // this specific pattern. We do NOT throw because that'd
            // starve the rest of the cron's per-appointment loop for
            // OTHER visitors.
            this.logger.error(
                `Failed to persist reminder state for appointment ${appointmentId} offset=${offsetKey}: ${e}`,
            );
        }
    }
}
