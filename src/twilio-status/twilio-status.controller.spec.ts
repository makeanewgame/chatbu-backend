import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

import { TwilioStatusController } from './twilio-status.controller';
import { OtpDeliveryFallbackService } from '../sms/otp-delivery-fallback.service';
import { LeadService } from '../lead/lead.service';
import { BookingService } from '../integration/booking/booking.service';

jest.mock('twilio', () => ({ validateRequest: jest.fn() }), { virtual: true });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio');

/**
 * The endpoint is PUBLIC — reachable at /api/webhooks/twilio/status
 * through the same ingress rule as the Meta webhooks. Its whole security
 * story is the signature check, and its whole purpose is turning one
 * asynchronous failure into an SMS exactly once. Both are pinned here.
 */
describe('TwilioStatusController', () => {
    let controller: TwilioStatusController;
    let fallback: { take: jest.Mock; register: jest.Mock };
    let lead: { requestSmsVerification: jest.Mock };
    let booking: { requestSmsVerification: jest.Mock };

    const originalEnv = { ...process.env };
    const req: any = { headers: { 'x-twilio-signature': 'sig' } };

    beforeEach(async () => {
        process.env.TWILIO_AUTH_TOKEN = 'token';
        process.env.TWILIO_STATUS_CALLBACK_URL = 'https://app.chatbu.io/api/webhooks/twilio/status';
        twilio.validateRequest.mockReturnValue(true);

        fallback = { take: jest.fn().mockResolvedValue(null), register: jest.fn() };
        lead = { requestSmsVerification: jest.fn().mockResolvedValue({ status: 'sent' }) };
        booking = { requestSmsVerification: jest.fn().mockResolvedValue({}) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TwilioStatusController],
            providers: [
                { provide: OtpDeliveryFallbackService, useValue: fallback },
                { provide: LeadService, useValue: lead },
                { provide: BookingService, useValue: booking },
            ],
        }).compile();
        controller = module.get(TwilioStatusController);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.clearAllMocks();
    });

    it('rejects an unsigned request — the endpoint is a free SMS trigger without this', async () => {
        await expect(
            controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'undelivered' }, { headers: {} } as any),
        ).rejects.toThrow(ForbiddenException);
        expect(fallback.take).not.toHaveBeenCalled();
    });

    it('rejects a request whose signature does not validate', async () => {
        twilio.validateRequest.mockReturnValue(false);

        await expect(
            controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'undelivered' }, req),
        ).rejects.toThrow(ForbiddenException);
        expect(fallback.take).not.toHaveBeenCalled();
    });

    it('validates against the configured URL, not one derived from the request', async () => {
        // A proxy header rewrite must not be able to change what we
        // validate against — Twilio signed the URL we gave it.
        await controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'delivered' }, req);

        expect(twilio.validateRequest).toHaveBeenCalledWith(
            'token',
            'sig',
            'https://app.chatbu.io/api/webhooks/twilio/status',
            { MessageSid: 'MM1', MessageStatus: 'delivered' },
        );
    });

    it('ignores every non-failure status without touching the registry', async () => {
        for (const status of ['queued', 'sent', 'delivered', 'read']) {
            await expect(
                controller.handleStatus({ MessageSid: 'MM1', MessageStatus: status }, req),
            ).resolves.toEqual({ received: true });
        }
        expect(fallback.take).not.toHaveBeenCalled();
    });

    it('re-sends over SMS through the booking flow when WhatsApp was undelivered', async () => {
        fallback.take.mockResolvedValue({
            flow: 'booking', botId: 'bot-1', chatId: 'chat-1', phone: '+905386450582', lang: 'tr',
        });

        await controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'undelivered' }, req);

        expect(booking.requestSmsVerification).toHaveBeenCalledWith(
            '+905386450582', 'bot-1', 'chat-1', 'tr',
        );
        expect(lead.requestSmsVerification).not.toHaveBeenCalled();
    });

    it('re-sends over SMS through the lead flow when that is where the code came from', async () => {
        fallback.take.mockResolvedValue({
            flow: 'lead', botId: 'bot-1', chatId: 'chat-1', phone: '+905386450582', lang: 'tr',
        });

        await controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'failed' }, req);

        expect(lead.requestSmsVerification).toHaveBeenCalledWith({
            botId: 'bot-1', chatId: 'chat-1', phone: '+905386450582', lang: 'tr',
        });
        expect(booking.requestSmsVerification).not.toHaveBeenCalled();
    });

    it('sends nothing for an unknown message id', async () => {
        fallback.take.mockResolvedValue(null);

        await expect(
            controller.handleStatus({ MessageSid: 'MM-unknown', MessageStatus: 'undelivered' }, req),
        ).resolves.toEqual({ received: true });
        expect(booking.requestSmsVerification).not.toHaveBeenCalled();
        expect(lead.requestSmsVerification).not.toHaveBeenCalled();
    });

    it('answers 200 even when the re-send throws, so Twilio does not retry a claimed context', async () => {
        // The context is consumed by `take`, so a retry could never
        // succeed — a 5xx would just make Twilio hammer us.
        fallback.take.mockResolvedValue({
            flow: 'booking', botId: 'bot-1', chatId: 'chat-1', phone: '+905386450582',
        });
        booking.requestSmsVerification.mockRejectedValue(new Error('TOO_MANY_REQUESTS'));

        await expect(
            controller.handleStatus({ MessageSid: 'MM1', MessageStatus: 'undelivered' }, req),
        ).resolves.toEqual({ received: true });
    });
});
