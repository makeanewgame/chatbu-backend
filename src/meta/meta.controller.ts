import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { verifyMetaWebhookSignature } from './webhook-signature.util';

@ApiTags('Meta Webhook')
@Controller('meta')
export class MetaController {
    private readonly logger = new Logger(MetaController.name);

    constructor(private readonly metaService: MetaService) { }

    @ApiOperation({ summary: 'Facebook webhook verification (GET hub.challenge)' })
    @Get('webhook')
    async verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') verifyToken: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        try {
            const result = await this.metaService.verifyWebhook(mode, verifyToken, challenge);
            res.status(200).send(result);
        } catch {
            res.status(403).send('Forbidden');
        }
    }

    @ApiOperation({ summary: 'Facebook webhook message receiver' })
    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(
        @Body() body: any,
        @Req() req: Request,
        @Headers('x-hub-signature-256') signature: string,
    ) {
        // Reject spoofed events: only Meta can produce a valid HMAC over the
        // payload using our app secret. Without this any client could inject
        // fake inbound messages into conversations.
        const isValid = verifyMetaWebhookSignature(
            (req as any).rawBody,
            signature,
            process.env.META_APP_SECRET,
        );
        if (!isValid) {
            this.logger.warn('[META-WEBHOOK] Rejected event with invalid signature');
            throw new ForbiddenException('Invalid signature');
        }

        await this.metaService.handleWebhook(body);
        return 'EVENT_RECEIVED';
    }
}
