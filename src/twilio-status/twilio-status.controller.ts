import { Body, Controller, ForbiddenException, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { OtpDeliveryFallbackService } from '../sms/otp-delivery-fallback.service';
import { LeadService } from '../lead/lead.service';
import { BookingService } from '../integration/booking/booking.service';

/**
 * Twilio message status callbacks — today, the WhatsApp→SMS rescue for
 * one-time codes.
 *
 * A WhatsApp send to a number with no WhatsApp account is ACCEPTED by
 * Twilio and fails minutes later, asynchronously, with nothing thrown.
 * This is the only signal that the visitor never got their code. It
 * needs no action from them and no cooperation from the agent, which is
 * what makes it work on Instagram and Messenger too — channels with no
 * card to put a "resend" button on.
 *
 * Reachable at `/api/webhooks/twilio/status` through the existing
 * `app.chatbu.io/api` ingress rule, alongside the Meta webhooks. No new
 * ingress, DNS entry or certificate.
 *
 * Statuses Twilio sends: queued → sent → delivered, or → undelivered /
 * failed. Only the last two are actionable; everything else is
 * acknowledged and dropped.
 */
@ApiTags('Twilio Webhook')
@Controller('webhooks/twilio/status')
export class TwilioStatusController {
    private readonly logger = new Logger(TwilioStatusController.name);

    private static readonly FAILED_STATUSES = new Set(['undelivered', 'failed']);

    constructor(
        private readonly otpDeliveryFallback: OtpDeliveryFallbackService,
        private readonly leadService: LeadService,
        private readonly bookingService: BookingService,
    ) { }

    @ApiOperation({ summary: 'Twilio message status callback (internal, signature-verified)' })
    @Post()
    @HttpCode(200)
    async handleStatus(@Body() body: any, @Req() req: Request) {
        this.assertTwilioSignature(req, body);

        const messageSid: string = body?.MessageSid ?? body?.SmsSid ?? '';
        const status: string = String(body?.MessageStatus ?? body?.SmsStatus ?? '').toLowerCase();

        if (!messageSid || !TwilioStatusController.FAILED_STATUSES.has(status)) {
            // Every successful delivery lands here too. Acknowledge and
            // drop — Twilio retries anything we don't 2xx.
            return { received: true };
        }

        // Claimed exactly once: Twilio retries status callbacks, and a
        // duplicate must not produce a second SMS.
        const context = await this.otpDeliveryFallback.take(messageSid);
        if (!context) {
            this.logger.log(
                `Twilio ${status} for sid=${messageSid} with no pending OTP fallback — ignoring`,
            );
            return { received: true };
        }

        this.logger.warn(
            `WhatsApp OTP ${status} for ${context.flow} chat=${context.chatId} — falling back to SMS`,
        );

        // Re-enter the flow's normal entry point rather than opening a
        // second send path. It resolves the channel itself (the WhatsApp
        // choice is already spent, so this goes over SMS), skips the
        // resend cooldown for exactly this channel switch, and keeps
        // every abuse cap in place.
        try {
            if (context.flow === 'booking') {
                await this.bookingService.requestSmsVerification(
                    context.phone,
                    context.botId,
                    context.chatId,
                    context.lang,
                );
            } else {
                await this.leadService.requestSmsVerification({
                    botId: context.botId,
                    chatId: context.chatId,
                    phone: context.phone,
                    lang: context.lang,
                });
            }
        } catch (err) {
            // Never 5xx at Twilio: it would retry, and a retry cannot
            // succeed because the context is already claimed. The
            // visitor is no worse off than before the fallback existed.
            this.logger.error(
                `SMS fallback failed for ${context.flow} chat=${context.chatId}: ${err}`,
            );
        }

        return { received: true };
    }

    /**
     * Twilio signs the exact callback URL plus the sorted POST params
     * with the account auth token. Without this check the endpoint is a
     * free SMS trigger for anyone who can guess a message id.
     *
     * `TWILIO_STATUS_CALLBACK_URL` is the URL Twilio was told to call, so
     * it is also the string it signed — deriving the URL from the request
     * would let a proxy header rewrite change what we validate against.
     */
    private assertTwilioSignature(req: Request, body: any): void {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const url = process.env.TWILIO_STATUS_CALLBACK_URL;
        const signature = req.headers['x-twilio-signature'];

        if (!authToken || !url) {
            this.logger.error(
                'Twilio status callback received but TWILIO_AUTH_TOKEN / TWILIO_STATUS_CALLBACK_URL is unset',
            );
            throw new ForbiddenException('Twilio status callback is not configured');
        }
        if (typeof signature !== 'string') {
            throw new ForbiddenException('Missing Twilio signature');
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const twilio = require('twilio');
        const valid = twilio.validateRequest(authToken, signature, url, body ?? {});
        if (!valid) {
            this.logger.warn(`Rejected Twilio status callback with an invalid signature`);
            throw new ForbiddenException('Invalid Twilio signature');
        }
    }
}
