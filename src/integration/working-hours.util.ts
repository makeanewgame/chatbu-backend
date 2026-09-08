import { DateTime } from 'luxon';
import { WEEKDAY_KEYS, WorkingHours } from 'src/appointment/appointment.constants';

/** Minutes since midnight for a "HH:mm" string. */
function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Is `now` inside the [start, end) window?
 *  - start <  end  → plain same-day window (09:00–18:00).
 *  - start >  end  → the window wraps past midnight (20:00–08:00 → active
 *                    when the local time is >= 20:00 OR < 08:00).
 *  - start == end  → empty window, never active.
 */
export function isWithinWindow(start: string, end: string, now: DateTime): boolean {
    const s = toMinutes(start);
    const e = toMinutes(end);
    const t = now.hour * 60 + now.minute;

    if (s === e) return false;
    if (s < e) return t >= s && t < e;
    return t >= s || t < e; // overnight
}

/**
 * Point-in-time check: is `now` inside `wh` for its local weekday? Mirrors
 * AppointmentAvailabilityService.validateSlot's weekday + time logic but for a
 * single instant, and additionally supports overnight day windows (start > end)
 * which the appointment picker never produces.
 *
 * `now` is expected to already be in the target zone (caller does `.setZone`).
 */
export function isWithinWorkingHours(wh: WorkingHours, now: DateTime): boolean {
    // Luxon weekday: 1=Monday..7=Sunday — matches WEEKDAY_KEYS order.
    const dayKey = WEEKDAY_KEYS[now.weekday - 1];
    const day = wh.days?.[dayKey];
    if (!day?.enabled) return false;
    return isWithinWindow(day.start, day.end, now);
}
