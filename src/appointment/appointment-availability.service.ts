import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleCalendarService } from 'src/integration/google-calendar/google-calendar.service';
import { DEFAULT_WORKING_HOURS, WEEKDAY_KEYS, WorkingHours } from './appointment.constants';

// How far ahead the inline picker offers slots. Google's freeBusy.query
// accepts this whole window in a single call.
const AVAILABILITY_RANGE_DAYS = 14;

export interface AvailabilityDay {
    date: string; // "YYYY-MM-DD", in the bot's working-hours timezone
    slots: string[]; // ISO-8601 with offset; empty means "working day, fully booked"
}

export interface AvailabilityResponse {
    timezone: string;
    slotMinutes: number;
    days: AvailabilityDay[];
    // Full per-weekday config (which days are open, start/end), so the FE's
    // "custom date" picker (a date outside AVAILABILITY_RANGE_DAYS, or one
    // the visitor wants to pick free-form) can restrict itself to the same
    // window `days[].slots` was computed from, instead of only being able
    // to offer whatever's already in the fetched 14-day list.
    workingHours: WorkingHours;
}

// Sentinel error codes shared verbatim with the MCP-side connectivity
// probe (mcp-server/calendar_tools.py's `_get_calendar_service` sentinels)
// so both surfaces describe the same failure the same way.
export type AvailabilityErrorCode = 'NO_CALENDAR_CONFIGURED' | 'CALENDAR_RECONNECT_REQUIRED';

export interface AvailabilityError {
    error: AvailabilityErrorCode;
}

@Injectable()
export class AppointmentAvailabilityService {
    private readonly logger = new Logger(AppointmentAvailabilityService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly googleCalendar: GoogleCalendarService,
    ) { }

    /**
     * Bookable slots for the next AVAILABILITY_RANGE_DAYS days: the bot's
     * configured working hours intersected with Google Calendar freebusy.
     * Only enabled weekdays are included in the response at all — a
     * working day with zero free slots is still included (empty `slots`)
     * so the FE can render a disabled chip rather than silently omitting
     * the day.
     *
     * Returns a plain `{ error }` object (not a thrown exception) when the
     * calendar isn't connected/needs reconnect — this is a widget-facing
     * endpoint, the caller falls back to the text-based booking flow
     * rather than surfacing an HTTP error to an anonymous visitor.
     */
    async getAvailableSlots(botId: string): Promise<AvailabilityResponse | AvailabilityError> {
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId },
            select: { appointmentWorkingHours: true },
        });
        const workingHours: WorkingHours =
            (bot?.appointmentWorkingHours as unknown as WorkingHours) ?? DEFAULT_WORKING_HOURS;

        const zone = workingHours.timezone;
        const now = DateTime.now().setZone(zone);
        const rangeEnd = now.plus({ days: AVAILABILITY_RANGE_DAYS }).endOf('day');

        let busy: { start: string; end: string }[];
        try {
            busy = await this.googleCalendar.getFreeBusy(botId, now.toISO()!, rangeEnd.toISO()!);
        } catch (e: any) {
            const status = e?.status ?? e?.getStatus?.();
            if (status === 404) return { error: 'NO_CALENDAR_CONFIGURED' };
            if (status === 410) return { error: 'CALENDAR_RECONNECT_REQUIRED' };
            this.logger.warn(`getAvailableSlots: freebusy lookup failed for bot ${botId}: ${e}`);
            return { error: 'NO_CALENDAR_CONFIGURED' };
        }

        const busyIntervals = busy.map((b) => ({
            start: DateTime.fromISO(b.start),
            end: DateTime.fromISO(b.end),
        }));

        const days: AvailabilityDay[] = [];
        for (let i = 0; i < AVAILABILITY_RANGE_DAYS; i++) {
            const day = now.plus({ days: i });
            // Luxon weekday: 1=Monday..7=Sunday, matches WEEKDAY_KEYS order.
            const weekdayKey = WEEKDAY_KEYS[day.weekday - 1];
            const config = workingHours.days[weekdayKey];
            if (!config?.enabled) continue;

            const [startH, startM] = config.start.split(':').map(Number);
            const [endH, endM] = config.end.split(':').map(Number);
            const dayEnd = day.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

            let slotStart = day.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
            const slots: string[] = [];
            while (slotStart.plus({ minutes: workingHours.slotMinutes }) <= dayEnd) {
                const slotEnd = slotStart.plus({ minutes: workingHours.slotMinutes });
                const isPast = slotStart < now;
                const overlapsBusy = busyIntervals.some((b) => slotStart < b.end && slotEnd > b.start);
                if (!isPast && !overlapsBusy) {
                    slots.push(slotStart.toISO()!);
                }
                slotStart = slotEnd;
            }

            days.push({ date: day.toISODate()!, slots });
        }

        return { timezone: zone, slotMinutes: workingHours.slotMinutes, days, workingHours };
    }
}
