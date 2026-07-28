import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';
import { AppointmentReminderService } from './appointment-reminder.service';

/**
 * Faz E tests: verify the reminder cron fires exactly once per
 * (appointment, offset), honors per-bot config, and doesn't
 * catastrophically fail on partial errors.
 *
 * Time is controlled with `jest.useFakeTimers({ now: ... })` so the
 * ±30s "due window" check is deterministic across CI hosts.
 */
describe('AppointmentReminderService.dispatchDueReminders', () => {
    let service: AppointmentReminderService;
    let prisma: {
        appointment: { findMany: jest.Mock; update: jest.Mock };
    };
    let sms: { sendBookingReminderSms: jest.Mock };

    // Fixed "now" for every test: 2026-10-05 14:30 Europe/Istanbul as UTC
    // → 11:30Z. All appointment startAt fixtures are derived from this
    // so the "due window" arithmetic is easy to reason about.
    const NOW = new Date('2026-10-05T11:30:00Z');

    beforeEach(async () => {
        prisma = {
            appointment: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
        };
        sms = { sendBookingReminderSms: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppointmentReminderService,
                { provide: PrismaService, useValue: prisma },
                { provide: SmsService, useValue: sms },
            ],
        }).compile();

        service = module.get(AppointmentReminderService);

        jest.useFakeTimers({ now: NOW.getTime() });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Helper to build an Appointment fixture whose startAt is `minutesFromNow`
    // in the future. Every field the cron reads is populated.
    function apptStartingIn(minutesFromNow: number, overrides: any = {}) {
        return {
            id: `appt_${minutesFromNow}`,
            attendeePhone: '905321112233',
            startAt: new Date(NOW.getTime() + minutesFromNow * 60 * 1000),
            summary: 'AI/LLM Bootcamp',
            timezone: 'Europe/Istanbul',
            calendarEventId: `evt_${minutesFromNow}`,
            reminderStates: {},
            bot: {
                botName: 'MyBot',
                appointmentReminderOffsets: [1440, 60],
            },
            ...overrides,
        };
    }

    // -------------------------------------------------------------------
    // Due-window arithmetic
    // -------------------------------------------------------------------

    it('fires the 60-minute reminder when startAt is 60 minutes from now', async () => {
        prisma.appointment.findMany.mockResolvedValue([apptStartingIn(60)]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).toHaveBeenCalledTimes(1);
        // 5th positional arg is `offsetMinutes` — must be the exact
        // offset that matched, so the SMS wording branch selects the
        // right template.
        expect(sms.sendBookingReminderSms.mock.calls[0][4]).toBe(60);
        // And the state-map update writes 'sent' under key '60'.
        const updateArgs = prisma.appointment.update.mock.calls[0][0];
        expect(updateArgs.data.reminderStates).toEqual({ '60': 'sent' });
    });

    it('fires the 1440-minute reminder when startAt is 24h from now', async () => {
        prisma.appointment.findMany.mockResolvedValue([apptStartingIn(1440)]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).toHaveBeenCalledTimes(1);
        expect(sms.sendBookingReminderSms.mock.calls[0][4]).toBe(1440);
    });

    it('skips offsets that are more than 30 seconds off the target time', async () => {
        // startAt = now + 62 minutes. The 60-minute offset target is
        // 2 minutes away — well outside the ±30s window.
        prisma.appointment.findMany.mockResolvedValue([apptStartingIn(62)]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).not.toHaveBeenCalled();
        expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('fires within the ±30s window (target 25s in the past still counts as due)', async () => {
        // startAt = now + 59:35 (60 min minus 25s). Target time for the
        // 60-minute offset is 25s in the past — inside the window.
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60 - 25 / 60),
        ]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------
    // Idempotency
    // -------------------------------------------------------------------

    it('does NOT re-fire an offset already marked "sent" in reminderStates', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { reminderStates: { '60': 'sent' } }),
        ]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).not.toHaveBeenCalled();
        expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('does NOT retry an offset already marked "failed" — failed is terminal', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { reminderStates: { '60': 'failed' } }),
        ]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).not.toHaveBeenCalled();
    });

    it('preserves other offsets in reminderStates when writing a new one', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { reminderStates: { '1440': 'sent' } }),
        ]);

        await service.dispatchDueReminders();

        const updateArgs = prisma.appointment.update.mock.calls[0][0];
        expect(updateArgs.data.reminderStates).toEqual({ '1440': 'sent', '60': 'sent' });
    });

    // -------------------------------------------------------------------
    // Per-bot config
    // -------------------------------------------------------------------

    it('skips bots whose appointmentReminderOffsets is empty (reminders disabled)', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { bot: { botName: 'MyBot', appointmentReminderOffsets: [] } }),
        ]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).not.toHaveBeenCalled();
        expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('only fires configured offsets (bot configured for 60 only, no 24h SMS)', async () => {
        // startAt = now + 60 min AND now + 1440 min are both due, but
        // bot only wants 60. Trying with the 60-min case: bot config
        // has only [60], so 1440 shouldn't be considered.
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { bot: { botName: 'MyBot', appointmentReminderOffsets: [60] } }),
        ]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).toHaveBeenCalledTimes(1);
        expect(sms.sendBookingReminderSms.mock.calls[0][4]).toBe(60);
    });

    it('falls back to "our team" as the bot name when the bot has none', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { bot: { botName: null, appointmentReminderOffsets: [60] } }),
        ]);

        await service.dispatchDueReminders();

        // 2nd positional arg is `botName`.
        expect(sms.sendBookingReminderSms.mock.calls[0][1]).toBe('our team');
    });

    // -------------------------------------------------------------------
    // Fault isolation — one failure must not starve the rest
    // -------------------------------------------------------------------

    it('marks a failed dispatch as "failed" and does not retry on the next tick', async () => {
        prisma.appointment.findMany.mockResolvedValue([apptStartingIn(60)]);
        sms.sendBookingReminderSms.mockRejectedValueOnce(new Error('NETGSM down'));

        await service.dispatchDueReminders();

        // Written as failed, not sent, not pending.
        const updateArgs = prisma.appointment.update.mock.calls[0][0];
        expect(updateArgs.data.reminderStates).toEqual({ '60': 'failed' });
    });

    it('keeps processing later appointments when an earlier one fails', async () => {
        prisma.appointment.findMany.mockResolvedValue([
            apptStartingIn(60, { id: 'appt_a' }),
            apptStartingIn(60, { id: 'appt_b', calendarEventId: 'evt_b' }),
        ]);
        // First send throws, second must still fire.
        sms.sendBookingReminderSms
            .mockRejectedValueOnce(new Error('NETGSM blip'))
            .mockResolvedValueOnce(undefined);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).toHaveBeenCalledTimes(2);
        // Two updates: one 'failed', one 'sent'.
        const outcomes = prisma.appointment.update.mock.calls
            .map((c) => c[0].data.reminderStates['60']);
        expect(outcomes).toEqual(['failed', 'sent']);
    });

    it('does not throw when persisting the state map fails (log-and-move-on)', async () => {
        prisma.appointment.findMany.mockResolvedValue([apptStartingIn(60)]);
        prisma.appointment.update.mockRejectedValue(new Error('pg conn lost'));

        // Must not raise — otherwise one bad row starves the rest of
        // the tick for every other visitor.
        await expect(service.dispatchDueReminders()).resolves.toBeUndefined();
    });

    // -------------------------------------------------------------------
    // Scan-window boundary
    // -------------------------------------------------------------------

    it('scans only future appointments within the 25-hour ceiling', async () => {
        // Return empty so the cron short-circuits after inspecting the
        // query — we only care that the `where` shape is right here.
        prisma.appointment.findMany.mockResolvedValue([]);

        await service.dispatchDueReminders();

        const where = prisma.appointment.findMany.mock.calls[0][0].where;
        expect(where.startAt.gt).toEqual(NOW);
        // 25*60 = 1500 minutes ahead
        const expectedCeiling = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
        expect(where.startAt.lt.getTime()).toBe(expectedCeiling.getTime());
    });

    it('quietly returns when no upcoming appointments exist', async () => {
        prisma.appointment.findMany.mockResolvedValue([]);

        await service.dispatchDueReminders();

        expect(sms.sendBookingReminderSms).not.toHaveBeenCalled();
        expect(prisma.appointment.update).not.toHaveBeenCalled();
    });
});
