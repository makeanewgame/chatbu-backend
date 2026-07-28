import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';

/**
 * Payload shape from the MCP `/appointment-created` hop. `create_appointment`
 * in mcp-server calls the backend right after a successful
 * `events.insert` — same fail-open contract as the existing
 * lead-notification hop: booking has already succeeded in Google
 * Calendar by the time we run, so no failure here can unwind it.
 */
export interface AppointmentCreatedPayload {
    botCuid: string;
    calendarEventId: string;
    attendeeName: string;
    attendeePhone: string;
    attendeeEmail: string;
    /** Both fields are ISO-8601 with timezone offset, matching what
     *  the MCP tool received from the agent. */
    startIso: string;
    endIso: string;
    summary: string;
    /** Optional description block the MCP tool composed (may include
     *  the "Attendee / Phone / Email" contact block). Not required. */
    description?: string;
    /** IANA zone name the calendar event was booked under. Passed
     *  through to the SMS confirmation body so times render in the
     *  visitor's own zone rather than the server's. */
    timezone: string;
    /** Optional language hint from the gateway (`tr` | `en`). Defaults
     *  to `tr` server-side since the vast majority of tenant traffic is
     *  Turkish. */
    lang?: 'tr' | 'en';
}

@Injectable()
export class AppointmentService {
    private readonly logger = new Logger(AppointmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sms: SmsService,
    ) { }

    /**
     * Persist a successful booking as an Appointment row and send a
     * confirmation SMS to the visitor.
     *
     * Idempotent on (botId, calendarEventId): a retried hop from the MCP
     * side (network wobble → agent retry loop → double-hop) hits the
     * unique constraint on the second call, catches the `P2002` error,
     * and returns the existing row instead of double-inserting or
     * double-SMSing. Same defense the MCP-side Redis dedup gives on the
     * calendar-insert path — belt + suspenders.
     *
     * Confirmation SMS is fail-open: if NETGSM is unreachable or the
     * bot's phone is bad, the Appointment row is still written and the
     * caller's HTTP response is still 200. A missing confirmation SMS
     * is a nuisance the reminder cron (Faz E) will paper over anyway
     * — the visitor still gets the Google Calendar invite email — but
     * we don't want the persistence write to depend on SMS success.
     */
    async createFromMcp(payload: AppointmentCreatedPayload) {
        const {
            botCuid,
            calendarEventId,
            attendeeName,
            attendeePhone,
            attendeeEmail,
            startIso,
            endIso,
            summary,
            description = '',
            timezone,
            lang = 'tr',
        } = payload;

        const startAt = new Date(startIso);
        const endAt = new Date(endIso);

        // Guard against agent-passed strings that don't parse — Date's
        // constructor tolerates all kinds of garbage and produces
        // `Invalid Date`, which downstream `.toISOString()` calls then
        // reject with a RangeError deep in the SMS formatter. Fail loud
        // at the boundary rather than deep in the reminder cron three
        // hours later.
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
            throw new Error(
                `AppointmentService.createFromMcp: invalid ISO date — startIso=${JSON.stringify(startIso)}, endIso=${JSON.stringify(endIso)}`,
            );
        }

        // Bot lookup for the SMS body's `botName`. Fail-soft to the
        // generic 'our team' label — matches BookingService's identical
        // fallback so the visitor-facing wording stays consistent
        // across OTP and confirmation.
        let botName = 'our team';
        try {
            const bot = await this.prisma.customerBots.findUnique({
                where: { id: botCuid },
                select: { botName: true },
            });
            if (bot?.botName) botName = bot.botName;
        } catch (e) {
            this.logger.warn(`Could not look up bot name for ${botCuid}: ${e}`);
        }

        // Idempotent write. Prisma raises `P2002` (Unique constraint
        // failed) on a duplicate (botId, calendarEventId) — that means
        // this exact booking already got persisted (retry, race, etc.),
        // so we return the existing row and skip the SMS. Any OTHER
        // error propagates so the MCP hop's outer try/catch can bucket
        // it (see calendar_tools.py's belt+suspenders wrapper).
        let appointment: Awaited<ReturnType<typeof this.prisma.appointment.create>>;
        try {
            appointment = await this.prisma.appointment.create({
                data: {
                    botId: botCuid,
                    calendarEventId,
                    attendeeName,
                    attendeePhone,
                    attendeeEmail,
                    startAt,
                    endAt,
                    summary,
                    description,
                    timezone,
                },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                this.logger.log(
                    `Appointment for bot=${botCuid} event=${calendarEventId} already persisted; skipping duplicate insert + confirmation SMS`,
                );
                const existing = await this.prisma.appointment.findUnique({
                    where: {
                        botId_calendarEventId: { botId: botCuid, calendarEventId },
                    },
                });
                return { appointmentId: existing?.id ?? null, confirmationSmsSent: false };
            }
            throw e;
        }

        // Confirmation SMS — best-effort. Absence is not silent: the
        // reminder cron (Faz E) reads `reminderStates` and will still
        // send its own SMS at the configured offsets, so the visitor
        // isn't left in the dark if this one fails. Log line + counter
        // (added in the metrics phase of the plan) surface the
        // frequency for alerting.
        let confirmationSmsSent = false;
        try {
            await this.sms.sendBookingConfirmationSms(
                attendeePhone,
                botName,
                startAt,
                summary,
                lang,
                timezone,
            );
            confirmationSmsSent = true;
        } catch (e) {
            this.logger.warn(
                `Confirmation SMS failed for appointment ${appointment.id} (event=${calendarEventId}): ${e}`,
            );
        }

        return { appointmentId: appointment.id, confirmationSmsSent };
    }
}
