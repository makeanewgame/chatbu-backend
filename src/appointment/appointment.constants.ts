export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkingHoursDay {
    enabled: boolean;
    start: string; // "HH:mm"
    end: string; // "HH:mm"
}

export interface WorkingHours {
    timezone: string; // IANA zone name
    slotMinutes: number;
    days: Record<WeekdayKey, WorkingHoursDay>;
}

export const WEEKDAY_KEYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const ALLOWED_SLOT_MINUTES = new Set([15, 30, 60]);

// Default for every bot: Turkey time, weekdays 09:00-18:00, weekends closed.
// Written verbatim into new bots at creation time (BotService.createBot) and
// backfilled onto every pre-existing bot by this field's migration — see
// prisma/schema.prisma's appointmentWorkingHours comment.
export const DEFAULT_WORKING_HOURS: WorkingHours = {
    timezone: 'Europe/Istanbul',
    slotMinutes: 30,
    days: {
        mon: { enabled: true, start: '09:00', end: '18:00' },
        tue: { enabled: true, start: '09:00', end: '18:00' },
        wed: { enabled: true, start: '09:00', end: '18:00' },
        thu: { enabled: true, start: '09:00', end: '18:00' },
        fri: { enabled: true, start: '09:00', end: '18:00' },
        sat: { enabled: false, start: '09:00', end: '18:00' },
        sun: { enabled: false, start: '09:00', end: '18:00' },
    },
};
