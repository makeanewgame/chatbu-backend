import { Body, Controller, Delete, Get, HttpCode, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { MetaService } from './meta.service';
import { MetaWhatsappService } from 'src/meta-whatsapp/meta-whatsapp.service';

@ApiTags('Meta Integration Callback')
@Controller('integrations/meta')
export class MetaIntegrationController {
    private readonly logger = new Logger(MetaIntegrationController.name);

    constructor(
        private readonly metaService: MetaService,
        private readonly metaWhatsappService: MetaWhatsappService,
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

    @ApiOperation({ summary: 'Facebook Meta deauthorize mock endpoint (GET)' })
    @Get('deauthorize')
    @HttpCode(200)
    handleGetDeauthorize(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/deauthorize request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/deauthorize',
            message: 'Meta deauthorize mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta deauthorize mock endpoint (POST)' })
    @Post('deauthorize')
    @HttpCode(200)
    handlePostDeauthorize(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/deauthorize request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/deauthorize',
            message: 'Meta deauthorize mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta data deletion mock endpoint (GET)' })
    @Get('data-deletion')
    @HttpCode(200)
    handleGetDataDeletion(@Query() query: Record<string, any>) {
        this.logger.log('Received GET /api/integrations/meta/data-deletion request');

        return {
            success: true,
            mock: true,
            method: 'GET',
            path: '/api/integrations/meta/data-deletion',
            message: 'Meta data deletion mock endpoint is active.',
            received: {
                query,
            },
        };
    }

    @ApiOperation({ summary: 'Facebook Meta data deletion mock endpoint (POST)' })
    @Post('data-deletion')
    @HttpCode(200)
    handlePostDataDeletion(
        @Query() query: Record<string, any>,
        @Body() body: Record<string, any>,
    ) {
        this.logger.log('Received POST /api/integrations/meta/data-deletion request');

        return {
            success: true,
            mock: true,
            method: 'POST',
            path: '/api/integrations/meta/data-deletion',
            message: 'Meta data deletion mock endpoint is active.',
            received: {
                query,
                body,
            },
        };
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
