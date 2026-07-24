import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Headers,
    HttpCode,
    Logger,
    Post,
    Query,
    Req,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MetaWhatsappService, WhatsAppWebhookBody } from './meta-whatsapp.service';
import { verifyMetaWebhookSignature } from '../meta/webhook-signature.util';

/**
 * Handles Meta WhatsApp webhook verification and event ingestion.
 *
 * This controller is intentionally excluded from the global `api` prefix so that
 * Meta can reach it at:
 *   GET  https://api.chatbu.io/webhooks/meta/whatsapp  (hub.challenge verification)
 *   POST https://api.chatbu.io/webhooks/meta/whatsapp  (incoming events)
 *
 * The exclusion is configured in main.ts via setGlobalPrefix({ exclude: [...] }).
 */
@ApiTags('Meta WhatsApp Webhook')
@Controller('webhooks/meta/whatsapp')
export class MetaWhatsappController {
    private readonly logger = new Logger(MetaWhatsappController.name);

    constructor(private readonly metaWhatsappService: MetaWhatsappService) { }

    @ApiOperation({ summary: 'WhatsApp webhook verification — returns hub.challenge as plain text' })
    @Get()
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') verifyToken: string,
        @Query('hub.challenge') challenge: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        this.logger.log(
            `[WA-WEBHOOK] GET verify | ip=${req.ip}` +
            ` | mode=${mode} | token=${verifyToken} | challenge=${challenge}`,
        );
        try {
            const result = this.metaWhatsappService.verifyWebhook(mode, verifyToken, challenge);
            this.logger.log(`[WA-WEBHOOK] GET verify SUCCESS — responding with challenge`);
            res.status(200).type('text/plain').send(result);
        } catch {
            this.logger.warn(`[WA-WEBHOOK] GET verify FAILED — token mismatch or invalid mode`);
            res.status(403).send('Forbidden');
        }
    }

    @ApiOperation({ summary: 'WhatsApp webhook event receiver — always returns 200 immediately' })
    @Post()
    @HttpCode(200)
    async handleWebhook(
        @Body() body: WhatsAppWebhookBody,
        @Req() req: Request,
        @Headers('x-hub-signature-256') signature: string,
    ) {
        this.logger.log(
            `[WA-WEBHOOK] POST received | ip=${req.ip}` +
            ` | object=${body?.object}` +
            ` | entries=${body?.entry?.length ?? 0}`,
        );

        // Reject spoofed events: only Meta can produce a valid HMAC over the
        // payload using our app secret. Without this any client could inject
        // fake inbound WhatsApp messages.
        const isValid = verifyMetaWebhookSignature(
            (req as any).rawBody,
            signature,
            process.env.META_APP_SECRET,
        );
        if (!isValid) {
            this.logger.warn('[WA-WEBHOOK] Rejected event with invalid signature');
            throw new ForbiddenException('Invalid signature');
        }

        try {
            await this.metaWhatsappService.handleWebhook(body);
        } catch (err) {
            // Swallow errors so Meta doesn't enter a retry loop
            this.logger.error('[WA-WEBHOOK] Error processing webhook body', err);
        }

        return { success: true };
    }
}
