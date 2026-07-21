import { randomBytes } from 'crypto';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { MetaService } from './meta.service';
import { MetaWhatsappService } from 'src/meta-whatsapp/meta-whatsapp.service';
import { MetaEmbeddedService } from 'src/integration/meta-embedded/meta-embedded.service';
import { parseSignedRequest } from './signed-request.util';

@ApiTags('Meta Integration Callback')
@Controller('integrations/meta')
export class MetaIntegrationController {
    private readonly logger = new Logger(MetaIntegrationController.name);

    constructor(
        private readonly metaService: MetaService,
        private readonly metaWhatsappService: MetaWhatsappService,
        private readonly metaEmbeddedService: MetaEmbeddedService,
        private readonly configService: ConfigService,
    ) { }

    @ApiOperation({ summary: 'Facebook Meta callback mock endpoint (GET)' })
    @Get('callback')
    @HttpCode(200)
    handleGetCallback(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/callback request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/callback',
            message: 'Meta callback mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta callback mock endpoint (POST)' })
    @Post('callback')
    @HttpCode(200)
    handlePostCallback(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/callback request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/callback',
            message: 'Meta callback mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
    }

    /**
     * Facebook calls this when a user removes Chatbu's access from their Facebook
     * settings. We locate every Messenger/Instagram embedded integration that user
     * connected (matched by the `user_id` in the signed_request) and remove it.
     */
    @ApiOperation({ summary: 'Facebook Meta deauthorize callback' })
    @Post('deauthorize')
    @HttpCode(200)
    async handlePostDeauthorize(@Body() body: { signed_request?: string }) {
        const parsed = this.verifySignedRequest(body?.signed_request);
        const deletedCount = await this.metaEmbeddedService.deleteByFbUserId(parsed.user_id);

        this.logger.log(`Deauthorize processed | fbUserId=${parsed.user_id} | deletedIntegrations=${deletedCount}`);

        return { success: true };
    }

    /**
     * Facebook's Data Deletion Request callback. Deletes the same data as deauthorize
     * and returns a status URL + confirmation code, per Meta's required response shape:
     * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
     */
    @ApiOperation({ summary: 'Facebook Meta data deletion callback' })
    @Post('data-deletion')
    @HttpCode(200)
    async handlePostDataDeletion(@Body() body: { signed_request?: string }, @Req() req: Request) {
        const parsed = this.verifySignedRequest(body?.signed_request);
        const deletedCount = await this.metaEmbeddedService.deleteByFbUserId(parsed.user_id);
        const confirmationCode = randomBytes(12).toString('hex');

        this.logger.log(`Data deletion processed | fbUserId=${parsed.user_id} | deletedIntegrations=${deletedCount} | confirmationCode=${confirmationCode}`);

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        return {
            url: `${baseUrl}/api/integrations/meta/data-deletion-status?id=${confirmationCode}`,
            confirmation_code: confirmationCode,
        };
    }

    /**
     * The human-readable status page Meta links the user to after a data deletion
     * request. Deletion already happened synchronously in the POST handler above,
     * so this just confirms it.
     */
    @ApiOperation({ summary: 'Data deletion status page shown to the user' })
    @Get('data-deletion-status')
    @HttpCode(200)
    getDataDeletionStatus(@Query('id') confirmationCode: string, @Res() res: Response) {
        res.type('html').send(
            `<!doctype html><html><head><meta charset="utf-8"><title>Chatbu - Veri Silme Durumu</title></head>` +
            `<body style="font-family: sans-serif; max-width: 480px; margin: 60px auto; text-align: center;">` +
            `<h2>Verileriniz silindi</h2>` +
            `<p>Chatbu'nun Facebook/Instagram entegrasyonu üzerinden sakladığı verileriniz kalıcı olarak silindi.</p>` +
            `<p style="color: #666; font-size: 13px;">Onay kodu: ${confirmationCode ?? '-'}</p>` +
            `</body></html>`,
        );
    }

    private verifySignedRequest(signedRequest?: string): { user_id: string } {
        if (!signedRequest) {
            throw new BadRequestException('Missing signed_request');
        }

        const appSecret = this.configService.get<string>('META_APP_SECRET');

        if (!appSecret) {
            throw new BadRequestException('META_APP_SECRET must be configured on the server');
        }

        const parsed = parseSignedRequest(signedRequest, appSecret);

        if (!parsed || !parsed.user_id) {
            throw new BadRequestException('Invalid signed_request');
        }

        return { user_id: parsed.user_id };
    }

    // ─── WhatsApp Test Endpoints (Temporary – Meta App Review) ─────────────────

    @ApiOperation({ summary: 'Send a WhatsApp message using test credentials (Admin only)' })
    @ApiBearerAuth()
    @Post('whatsapp/test-send')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async testSendWhatsApp(@Body() body: { to: string; message: string }) {
        this.logger.log(`POST /api/integrations/meta/whatsapp/test-send to=${body.to}`);
        return this.metaService.testSendWhatsApp(body.to, body.message);
    }

    @ApiOperation({ summary: 'Chat with a bot and send the reply via WhatsApp (Admin only)' })
    @ApiBearerAuth()
    @Post('whatsapp/test-chat')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async testChatWhatsApp(@Body() body: { botId: string; to: string; message: string }) {
        this.logger.log(`POST /api/integrations/meta/whatsapp/test-chat botId=${body.botId} to=${body.to}`);
        return this.metaService.testChatWhatsApp(body.botId, body.to, body.message);
    }

    @ApiOperation({ summary: 'Activate webhook test mode: route test phone number messages to a bot (Admin only)' })
    @ApiBearerAuth()
    @Post('whatsapp/test-activate')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async testActivate(@Body() body: { botId: string }) {
        this.logger.log(`POST /api/integrations/meta/whatsapp/test-activate botId=${body.botId}`);
        await this.metaWhatsappService.setTestBot(body.botId);
        return { success: true, botId: body.botId };
    }

    @ApiOperation({ summary: 'Deactivate webhook test mode (Admin only)' })
    @ApiBearerAuth()
    @Delete('whatsapp/test-activate')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async testDeactivate() {
        this.logger.log('DELETE /api/integrations/meta/whatsapp/test-activate');
        await this.metaWhatsappService.setTestBot(null);
        return { success: true };
    }

    @ApiOperation({ summary: 'Get live webhook test conversation messages (Admin only)' })
    @ApiBearerAuth()
    @Get('whatsapp/test-messages')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async getTestMessages() {
        return this.metaWhatsappService.getTestState();
    }

    @ApiOperation({ summary: 'Clear webhook test conversation history (Admin only)' })
    @ApiBearerAuth()
    @Delete('whatsapp/test-messages')
    @UseGuards(AccessTokenGuard, AdminGuard)
    async clearTestMessages() {
        this.logger.log('DELETE /api/integrations/meta/whatsapp/test-messages');
        await this.metaWhatsappService.clearTestMessages();
        return { success: true };
    }
}
