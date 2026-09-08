import { WeekdayKey, WorkingHoursDay, WEEKDAY_KEYS } from 'src/appointment/appointment.constants';

/**
 * Per-integration auto-reply schedule. Persisted as `Integrations.schedule`
 * (JSON, nullable — NULL is treated as `always`). Messaging channels only
 * (WhatsApp / Messenger / Instagram).
 */
export type IntegrationScheduleMode =
    | 'always' // 7/24 — bot always auto-replies (default)
    | 'off' // bot never auto-replies on this channel
    | 'business_hours' // active while inside the bot's appointmentWorkingHours window
    | 'outside_business_hours' // active while OUTSIDE that window
    | 'weekends' // active all day Saturday + Sunday
    | 'nights' // active every day 20:00–08:00 (fixed window)
    | 'custom'; // active per the `days` map below

export interface IntegrationSchedule {
    mode: IntegrationScheduleMode;
    // IANA zone name. Optional — falls back to the bot's business-hours
    // timezone, then DEFAULT_FALLBACK_TIMEZONE.
    timezone?: string;
    // Required when mode === 'custom'. Same shape as WorkingHours.days; a day
    // window whose start > end wraps past midnight (e.g. 22:00–06:00).
    days?: Record<WeekdayKey, WorkingHoursDay>;
}

export const INTEGRATION_SCHEDULE_MODES: IntegrationScheduleMode[] = [
    'always',
    'off',
    'business_hours',
    'outside_business_hours',
    'weekends',
    'nights',
    'custom',
];

// Fixed "nights" window — active from 20:00 through 08:00 the next morning.
export const INTEGRATION_NIGHT_WINDOW = { start: '20:00', end: '08:00' } as const;

export const DEFAULT_FALLBACK_TIMEZONE = 'Europe/Istanbul';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Imperative validation (same tradeoff as AppointmentService.validateWorkingHours
 * — a fixed 7-key day map is easier to walk than to express as a nested-DTO
 * decorator tree). Returns a human-readable reason string, or null when valid.
 */
export function validateIntegrationSchedule(schedule: IntegrationSchedule): string | null {
    if (!schedule || typeof schedule !== 'object') return 'schedule is required';
    if (!INTEGRATION_SCHEDULE_MODES.includes(schedule.mode)) {
        return `invalid mode "${schedule.mode}"`;
    }

    if (schedule.timezone !== undefined) {
        if (typeof schedule.timezone !== 'string') return 'timezone must be a string';
        try {
            // Throws RangeError for an invalid IANA zone name.
            new Intl.DateTimeFormat(undefined, { timeZone: schedule.timezone });
        } catch {
            return `invalid timezone "${schedule.timezone}"`;
        }
    }

    if (schedule.mode === 'custom') {
        if (!schedule.days || typeof schedule.days !== 'object') {
            return 'custom mode requires a days map';
        }
        for (const key of WEEKDAY_KEYS) {
            const day = schedule.days[key];
            if (!day || typeof day !== 'object') return `missing day "${key}"`;
            if (typeof day.enabled !== 'boolean') return `day "${key}".enabled must be a boolean`;
            if (!TIME_RE.test(day.start)) return `day "${key}".start must be "HH:mm"`;
            if (!TIME_RE.test(day.end)) return `day "${key}".end must be "HH:mm"`;
        }
    }

    return null;
}
