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

// Owner-defined appointment types for bots that offer more than one kind of
// booking (e.g. salon: {name:"Haircut", minutes:30} + {name:"Coloring",
// minutes:90}). The agent picks a type based on conversation intent and
// passes its duration to `request_booking_slot_picker`, so slot granularity
// + ISO_END match the actual appointment length. Empty list = bot uses only
// the WorkingHours.slotMinutes default. Platform-generic naming — no
// vertical/tenant assumption baked in.
export interface AppointmentType {
    name: string; // owner-visible label, 1-60 chars, unique per bot (case-insensitive)
    minutes: number; // 15..480 in 5-min steps; UI exposes 15/30/45/60/90/120
}

export const APPOINTMENT_TYPES_MAX = 20;
export const APPOINTMENT_TYPE_NAME_MAX = 60;
export const APPOINTMENT_TYPE_MIN_MINUTES = 15;
export const APPOINTMENT_TYPE_MAX_MINUTES = 480;

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
