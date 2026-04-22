import { Body, Controller, Get, HttpCode, Logger, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('WhatsApp Webhook')
@Controller('whatsapp')
export class WhatsAppController {
    private readonly logger = new Logger(WhatsAppController.name);

    constructor(private readonly whatsappService: WhatsAppService) {}

    @ApiOperation({ summary: 'WhatsApp webhook verification (GET hub.challenge)' })
    @Get('webhook')
    async verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') verifyToken: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        try {
            const result = await this.whatsappService.verifyWebhook(mode, verifyToken, challenge);
            res.status(200).send(result);
        } catch {
            res.status(403).send('Forbidden');
        }
    }

    @ApiOperation({ summary: 'WhatsApp webhook message receiver' })
    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Body() body: any) {
        await this.whatsappService.handleWebhook(body);
        return 'EVENT_RECEIVED';
    }
}
