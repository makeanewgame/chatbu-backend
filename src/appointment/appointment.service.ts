import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FlowKind } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';
import { ChatFlowService } from 'src/chat-flow/chat-flow.service';
import {
    ALLOWED_SLOT_MINUTES,
    APPOINTMENT_TYPE_MAX_MINUTES,
    APPOINTMENT_TYPE_MIN_MINUTES,
    APPOINTMENT_TYPE_NAME_MAX,
    APPOINTMENT_TYPES_MAX,
    AppointmentType,
    WEEKDAY_KEYS,
    WorkingHours,
} from './appointment.constants';

// Only the two offsets the FE exposes today. Rejecting unknown offsets
// prevents an attacker (or a wonky proxy) from smuggling a wildly
// off-band value like 10080 (a week) into the cron scan window, which
// would silently expand the scan range and pull in appointments we
// weren't meant to remind for. If we ever need a third offset the FE
// adds a checkbox and this whitelist grows in lockstep.
const ALLOWED_REMINDER_OFFSETS = new Set([60, 1440]);

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
    /** Optional chatId forwarded from the MCP tool call so
     *  `AppointmentService` can advance `PerChatFlowState BOOKING`
     *  to `BOOKED`. Older MCP pods (pre-Faz-3a) don't pass this;
     *  `safeTransition` silently no-ops when absent. */
    chatId?: string;
}

@Injectable()
export class AppointmentService {
    private readonly logger = new Logger(AppointmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sms: SmsService,
        private readonly chatFlow: ChatFlowService,
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
            chatId,
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

        // Terminal BOOKING state — this appointment is now booked. `from`
        // pinned to `OTP_VERIFIED` optimistically; a mismatch means the
        // BOOKING flow never went through the OTP path for this chat
        // (agent skipped the SMS step somehow, or the reminder job is
        // the caller). safeTransition logs + swallows either way — the
        // Appointment row is already written, state-store is a
        // secondary index.
        await this.chatFlow.safeTransition(botCuid, chatId, FlowKind.BOOKING, {
            from: 'OTP_VERIFIED',
            to: 'BOOKED',
            payload: {
                source: 'appointment_created',
                appointment_id: appointment.id,
                calendar_event_id: calendarEventId,
                start_iso: startIso,
            },
        }, 'appointment:createFromMcp');

        return { appointmentId: appointment.id, confirmationSmsSent };
    }

    /**
     * Update the per-bot appointment-reminder offsets. The FE exposes
     * two checkboxes (24h before / 1h before); the caller sends the
     * subset that's checked. An empty array disables reminders entirely
     * for the bot. Any offset value not in ALLOWED_REMINDER_OFFSETS is
     * rejected — FE misconfig or unauthorized proxy tampering must not
     * silently expand what the cron will scan/dispatch.
     *
     * Team ownership check is here (not just at the controller layer)
     * so any future non-HTTP caller (background job, admin CLI) still
     * can't cross tenant boundaries.
     */
    async updateReminderOffsets(botId: string, teamId: string, offsets: number[]) {
        // Dedup + sort — order isn't semantically meaningful but a
        // canonical form makes the persisted value stable across
        // updates (owner unchecks + rechecks same box in different
        // order shouldn't produce a diff).
        const cleaned = Array.from(new Set(offsets)).sort((a, b) => a - b);

        for (const off of cleaned) {
            if (!ALLOWED_REMINDER_OFFSETS.has(off)) {
                throw new ForbiddenException(
                    `Unsupported reminder offset ${off}. Allowed: ${[...ALLOWED_REMINDER_OFFSETS].join(', ')}.`,
                );
            }
        }

        // Verify the bot exists AND belongs to the caller's team before
        // any write. Fetching first (rather than a scoped updateMany
        // returning count=0 on mismatch) lets us differentiate 404 from
        // 403 for the FE.
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId },
            select: { id: true, teamId: true },
        });
        if (!bot) {
            throw new NotFoundException(`Bot ${botId} not found`);
        }
        if (bot.teamId !== teamId) {
            throw new ForbiddenException(`Bot ${botId} does not belong to your team`);
        }

        const updated = await this.prisma.customerBots.update({
            where: { id: botId },
            data: { appointmentReminderOffsets: cleaned },
            select: { id: true, appointmentReminderOffsets: true },
        });
        this.logger.log(
            `Updated appointmentReminderOffsets for bot ${botId} → [${cleaned.join(', ')}]`,
        );
        return updated;
    }

    /**
     * Update the per-bot appointment working-hours window used by the
     * inline calendar picker (AppointmentAvailabilityService intersects
     * this with Google Calendar freebusy). Validated imperatively rather
     * than via class-validator nested-DTO decorators — the same tradeoff
     * `settings: Json?` makes elsewhere in this model — because the
     * shape is a fixed 7-key day map that's easier to walk by hand than
     * to express as a decorator tree.
     */
    async updateWorkingHours(botId: string, teamId: string, workingHours: WorkingHours) {
        this.validateWorkingHours(workingHours);

        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId },
            select: { id: true, teamId: true },
        });
        if (!bot) {
            throw new NotFoundException(`Bot ${botId} not found`);
        }
        if (bot.teamId !== teamId) {
            throw new ForbiddenException(`Bot ${botId} does not belong to your team`);
        }

        const updated = await this.prisma.customerBots.update({
            where: { id: botId },
            data: { appointmentWorkingHours: workingHours as any },
            select: { id: true, appointmentWorkingHours: true },
        });
        this.logger.log(`Updated appointmentWorkingHours for bot ${botId}`);
        return updated;
    }

    /**
     * Update the per-bot list of appointment types (name + minutes). Empty
     * list is allowed — signals "bot uses only WorkingHours.slotMinutes for
     * every booking" (the pre-#24 behaviour). Validated imperatively same as
     * updateWorkingHours; caps + shape checks below match
     * appointment.constants.ts. Owner-visible only via the appointment-
     * enabled bot settings screen; the rest of the platform ignores this
     * column.
     */
    async updateAppointmentTypes(botId: string, teamId: string, types: AppointmentType[]) {
        this.validateAppointmentTypes(types);

        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId },
            select: { id: true, teamId: true },
        });
        if (!bot) {
            throw new NotFoundException(`Bot ${botId} not found`);
        }
        if (bot.teamId !== teamId) {
            throw new ForbiddenException(`Bot ${botId} does not belong to your team`);
        }

        const updated = await this.prisma.customerBots.update({
            where: { id: botId },
            data: { appointmentTypes: types as any },
            select: { id: true, appointmentTypes: true },
        });
        this.logger.log(`Updated appointmentTypes for bot ${botId} (${types.length} types)`);
        return updated;
    }

    private validateAppointmentTypes(types: AppointmentType[]) {
        if (!Array.isArray(types)) {
            throw new ForbiddenException('appointmentTypes must be an array');
        }
        if (types.length > APPOINTMENT_TYPES_MAX) {
            throw new ForbiddenException(
                `appointmentTypes exceeds max of ${APPOINTMENT_TYPES_MAX}`,
            );
        }
        // Case-insensitive uniqueness so owner can't accidentally save
        // "Massage" + "massage" as two separate entries the agent then can't
        // disambiguate.
        const seenNames = new Set<string>();
        for (const [i, t] of types.entries()) {
            if (!t || typeof t !== 'object') {
                throw new ForbiddenException(`appointmentTypes[${i}] is not an object`);
            }
            if (typeof t.name !== 'string' || !t.name.trim()) {
                throw new ForbiddenException(`appointmentTypes[${i}].name is required`);
            }
            if (t.name.length > APPOINTMENT_TYPE_NAME_MAX) {
                throw new ForbiddenException(
                    `appointmentTypes[${i}].name exceeds ${APPOINTMENT_TYPE_NAME_MAX} chars`,
                );
            }
            const key = t.name.trim().toLowerCase();
            if (seenNames.has(key)) {
                throw new ForbiddenException(
                    `appointmentTypes[${i}].name "${t.name}" is duplicated`,
                );
            }
            seenNames.add(key);
            if (
                typeof t.minutes !== 'number' ||
                !Number.isInteger(t.minutes) ||
                t.minutes < APPOINTMENT_TYPE_MIN_MINUTES ||
                t.minutes > APPOINTMENT_TYPE_MAX_MINUTES ||
                t.minutes % 5 !== 0
            ) {
                throw new ForbiddenException(
                    `appointmentTypes[${i}].minutes must be an integer in [${APPOINTMENT_TYPE_MIN_MINUTES}, ${APPOINTMENT_TYPE_MAX_MINUTES}] in 5-minute steps`,
                );
            }
        }
    }

    private validateWorkingHours(workingHours: WorkingHours) {
        if (!workingHours || typeof workingHours !== 'object') {
            throw new ForbiddenException('workingHours is required');
        }
        if (!ALLOWED_SLOT_MINUTES.has(workingHours.slotMinutes)) {
            throw new ForbiddenException(
                `Unsupported slotMinutes ${workingHours.slotMinutes}. Allowed: ${[...ALLOWED_SLOT_MINUTES].join(', ')}.`,
            );
        }
        try {
            // Throws RangeError for an invalid IANA zone name.
            new Intl.DateTimeFormat(undefined, { timeZone: workingHours.timezone });
        } catch {
            throw new ForbiddenException(`Invalid timezone "${workingHours.timezone}"`);
        }

        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        for (const key of WEEKDAY_KEYS) {
            const day = workingHours.days?.[key];
            if (!day) {
                throw new ForbiddenException(`Missing day "${key}" in workingHours.days`);
            }
            if (!timeRegex.test(day.start) || !timeRegex.test(day.end)) {
                throw new ForbiddenException(`Invalid time format for day "${key}", expected HH:mm`);
            }
            if (day.enabled && day.start >= day.end) {
                throw new ForbiddenException(`Day "${key}" has start >= end`);
            }
        }
    }
}
