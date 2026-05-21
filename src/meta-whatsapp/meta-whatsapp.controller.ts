import {
    Body,
    Controller,
    Get,
    HttpCode,
    Logger,
    Post,
    Query,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetaWhatsappService, WhatsAppWebhookBody } from './meta-whatsapp.service';

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
        @Res() res: Response,
    ) {
        try {
            const result = this.metaWhatsappService.verifyWebhook(mode, verifyToken, challenge);
            res.status(200).type('text/plain').send(result);
        } catch {
            res.status(403).send('Forbidden');
        }
    }

    @ApiOperation({ summary: 'WhatsApp webhook event receiver — always returns 200 immediately' })
    @Post()
    @HttpCode(200)
    async handleWebhook(@Body() body: WhatsAppWebhookBody) {
        try {
            await this.metaWhatsappService.handleWebhook(body);
        } catch (err) {
            // Swallow errors so Meta doesn't enter a retry loop
            this.logger.error('Error processing WhatsApp webhook body', err);
        }

        return { success: true };
    }
}
