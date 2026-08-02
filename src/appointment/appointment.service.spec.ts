import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { SmsService } from 'src/sms/sms.service';
import { ChatFlowService } from 'src/chat-flow/chat-flow.service';
import { AppointmentService, AppointmentCreatedPayload } from './appointment.service';

/**
 * Faz D tests: verify AppointmentService.createFromMcp does the two
 * jobs it's on the hook for — persist an Appointment row AND fire a
 * confirmation SMS — with the right idempotency and fail-soft
 * semantics.
 *
 * Prisma + SmsService are both mocked; no DB, no NETGSM.
 */
describe('AppointmentService.createFromMcp', () => {
    let service: AppointmentService;
    let prisma: {
        appointment: {
            create: jest.Mock;
            findUnique: jest.Mock;
        };
        customerBots: { findUnique: jest.Mock };
    };
    let sms: { sendBookingConfirmationSms: jest.Mock };

    // 2026-10-06 14:30 Europe/Istanbul as UTC — the fixture the SMS
    // service tests already use, so any datetime-format regression is
    // caught by whichever suite runs first.
    const START_ISO = '2026-10-06T14:30:00+03:00';
    const END_ISO = '2026-10-06T15:30:00+03:00';

    const basePayload = (): AppointmentCreatedPayload => ({
        botCuid: 'bot_1',
        calendarEventId: 'evt_x',
        attendeeName: 'Erkan Şirin',
        attendeePhone: '905321112233',
        attendeeEmail: 'visitor@example.com',
        startIso: START_ISO,
        endIso: END_ISO,
        summary: 'AI/LLM Bootcamp',
        description: 'Attendee: Erkan Şirin\nPhone: 905321112233',
        timezone: 'Europe/Istanbul',
        lang: 'tr',
    });

    beforeEach(async () => {
        prisma = {
            appointment: {
                create: jest.fn(),
                findUnique: jest.fn(),
            },
            customerBots: { findUnique: jest.fn() },
        };
        sms = { sendBookingConfirmationSms: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppointmentService,
                { provide: PrismaService, useValue: prisma },
                { provide: SmsService, useValue: sms },
                { provide: ChatFlowService, useValue: { safeTransition: jest.fn() } },
            ],
        }).compile();

        service = module.get(AppointmentService);
    });

    // -------------------------------------------------------------------
    // Happy path: insert + SMS
    // -------------------------------------------------------------------

    it('persists an Appointment row with all payload fields mapped through', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        const result = await service.createFromMcp(basePayload());

        expect(result).toEqual({ appointmentId: 'appt_1', confirmationSmsSent: true });
        const createArgs = prisma.appointment.create.mock.calls[0][0];
        expect(createArgs.data.botId).toBe('bot_1');
        expect(createArgs.data.calendarEventId).toBe('evt_x');
        expect(createArgs.data.attendeeName).toBe('Erkan Şirin');
        expect(createArgs.data.attendeePhone).toBe('905321112233');
        expect(createArgs.data.attendeeEmail).toBe('visitor@example.com');
        expect(createArgs.data.summary).toBe('AI/LLM Bootcamp');
        expect(createArgs.data.timezone).toBe('Europe/Istanbul');
        expect(createArgs.data.startAt).toBeInstanceOf(Date);
        expect(createArgs.data.endAt).toBeInstanceOf(Date);
        // ISO string → Date should round-trip to the same instant.
        expect(createArgs.data.startAt.toISOString()).toBe('2026-10-06T11:30:00.000Z');
    });

    it('sends the confirmation SMS with the bot name looked up from Prisma', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        await service.createFromMcp(basePayload());

        expect(sms.sendBookingConfirmationSms).toHaveBeenCalledWith(
            '905321112233',
            'MyBot',
            expect.any(Date),
            'AI/LLM Bootcamp',
            'tr',
            'Europe/Istanbul',
        );
    });

    it('falls back to "our team" when the bot lookup fails or the bot has no name', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockRejectedValue(new Error('db down'));

        await service.createFromMcp(basePayload());

        // 2nd arg is botName — mirrors the BookingService fallback text.
        expect(sms.sendBookingConfirmationSms).toHaveBeenCalledWith(
            '905321112233',
            'our team',
            expect.any(Date),
            'AI/LLM Bootcamp',
            'tr',
            'Europe/Istanbul',
        );
    });

    it('defaults lang to "tr" when the payload omits it', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        const { lang: _drop, ...payloadNoLang } = basePayload();
        await service.createFromMcp(payloadNoLang);

        // 5th positional arg is lang.
        const langArg = sms.sendBookingConfirmationSms.mock.calls[0][4];
        expect(langArg).toBe('tr');
    });

    it('defaults description to empty string when payload omits it', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        const { description: _drop, ...payloadNoDesc } = basePayload();
        await service.createFromMcp(payloadNoDesc);

        const createArgs = prisma.appointment.create.mock.calls[0][0];
        expect(createArgs.data.description).toBe('');
    });

    // -------------------------------------------------------------------
    // Fail-soft: SMS failure MUST NOT block the row
    // -------------------------------------------------------------------

    it('persists the row even when the confirmation SMS throws', async () => {
        prisma.appointment.create.mockResolvedValue({ id: 'appt_1' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });
        sms.sendBookingConfirmationSms.mockRejectedValue(new Error('NETGSM down'));

        const result = await service.createFromMcp(basePayload());

        expect(prisma.appointment.create).toHaveBeenCalled();
        expect(result.appointmentId).toBe('appt_1');
        expect(result.confirmationSmsSent).toBe(false);
    });

    // -------------------------------------------------------------------
    // Idempotency: retried hop must not double-write, double-SMS
    // -------------------------------------------------------------------

    it('handles a duplicate (botId, calendarEventId) unique-constraint error idempotently', async () => {
        // Prisma raises P2002 on the unique index we defined for
        // (botId, calendarEventId). The service catches it, refetches
        // the existing row, and skips the confirmation SMS so the
        // visitor never gets two.
        const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        prisma.appointment.create.mockRejectedValue(p2002);
        prisma.appointment.findUnique.mockResolvedValue({ id: 'appt_existing' });
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        const result = await service.createFromMcp(basePayload());

        expect(result).toEqual({ appointmentId: 'appt_existing', confirmationSmsSent: false });
        expect(sms.sendBookingConfirmationSms).not.toHaveBeenCalled();
        expect(prisma.appointment.findUnique).toHaveBeenCalledWith({
            where: { botId_calendarEventId: { botId: 'bot_1', calendarEventId: 'evt_x' } },
        });
    });

    it('propagates non-P2002 Prisma errors so the caller can 4xx / 5xx', async () => {
        const oops = Object.assign(new Error('connection lost'), { code: 'P1017' });
        prisma.appointment.create.mockRejectedValue(oops);
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        await expect(service.createFromMcp(basePayload())).rejects.toThrow(
            'connection lost',
        );
        expect(sms.sendBookingConfirmationSms).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // Input validation at the service boundary (belt vs. suspenders)
    // -------------------------------------------------------------------

    it('throws loudly on malformed ISO date rather than persisting garbage', async () => {
        const payload = { ...basePayload(), startIso: 'not a real date' };
        prisma.customerBots.findUnique.mockResolvedValue({ botName: 'MyBot' });

        await expect(service.createFromMcp(payload)).rejects.toThrow(
            /invalid ISO date/,
        );
        expect(prisma.appointment.create).not.toHaveBeenCalled();
    });
});


// ---------------------------------------------------------------------------
// Faz E: updateReminderOffsets — FE-facing per-bot config
// ---------------------------------------------------------------------------
describe('AppointmentService.updateReminderOffsets', () => {
    let service: AppointmentService;
    let prisma: {
        customerBots: { findUnique: jest.Mock; update: jest.Mock };
    };

    beforeEach(async () => {
        prisma = {
            customerBots: { findUnique: jest.fn(), update: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppointmentService,
                { provide: PrismaService, useValue: prisma },
                { provide: SmsService, useValue: {} },
                { provide: ChatFlowService, useValue: { safeTransition: jest.fn() } },
            ],
        }).compile();

        service = module.get(AppointmentService);
    });

    it('persists a whitelisted offset set for a bot the caller owns', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_a' });
        prisma.customerBots.update.mockResolvedValue({
            id: 'bot_1',
            appointmentReminderOffsets: [60, 1440],
        });

        const result = await service.updateReminderOffsets('bot_1', 'team_a', [1440, 60]);

        // Canonical form: sorted, de-duplicated. Owner-flipping-then-
        // re-flipping the same box in a different order shouldn't
        // produce a stored diff — checked against the update args.
        const updateArgs = prisma.customerBots.update.mock.calls[0][0];
        expect(updateArgs.data.appointmentReminderOffsets).toEqual([60, 1440]);
        expect(result.appointmentReminderOffsets).toEqual([60, 1440]);
    });

    it('accepts an empty array to disable reminders for the bot', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_a' });
        prisma.customerBots.update.mockResolvedValue({
            id: 'bot_1',
            appointmentReminderOffsets: [],
        });

        await service.updateReminderOffsets('bot_1', 'team_a', []);

        expect(prisma.customerBots.update.mock.calls[0][0].data.appointmentReminderOffsets).toEqual([]);
    });

    it('deduplicates repeated offsets before persisting', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_a' });
        prisma.customerBots.update.mockResolvedValue({
            id: 'bot_1',
            appointmentReminderOffsets: [60],
        });

        await service.updateReminderOffsets('bot_1', 'team_a', [60, 60]);

        expect(prisma.customerBots.update.mock.calls[0][0].data.appointmentReminderOffsets).toEqual([60]);
    });

    it('rejects an offset outside the allowed whitelist', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_a' });

        // 10080 = 7 days. Not on the FE. The whitelist stops any wonky
        // proxy or scripted client from smuggling wildly off-band values
        // into the cron's scan window.
        await expect(
            service.updateReminderOffsets('bot_1', 'team_a', [10080]),
        ).rejects.toThrow(/Unsupported reminder offset/);
        expect(prisma.customerBots.update).not.toHaveBeenCalled();
    });

    it('rejects an offset even when it is bundled with a valid one', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_a' });

        await expect(
            service.updateReminderOffsets('bot_1', 'team_a', [60, 9999]),
        ).rejects.toThrow(/Unsupported reminder offset/);
        expect(prisma.customerBots.update).not.toHaveBeenCalled();
    });

    it('404s when the bot does not exist', async () => {
        prisma.customerBots.findUnique.mockResolvedValue(null);

        await expect(
            service.updateReminderOffsets('bot_ghost', 'team_a', [60]),
        ).rejects.toThrow(/not found/);
        expect(prisma.customerBots.update).not.toHaveBeenCalled();
    });

    it('403s when the bot belongs to a different team', async () => {
        prisma.customerBots.findUnique.mockResolvedValue({ id: 'bot_1', teamId: 'team_b' });

        await expect(
            service.updateReminderOffsets('bot_1', 'team_a', [60]),
        ).rejects.toThrow(/does not belong to your team/);
        expect(prisma.customerBots.update).not.toHaveBeenCalled();
    });
});
