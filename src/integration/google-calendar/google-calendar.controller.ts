import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
import { GoogleCalendarService } from './google-calendar.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Google Calendar Integration')
@Controller('integration/google-calendar')
export class GoogleCalendarController {
    constructor(
        private readonly googleCalendarService: GoogleCalendarService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * POST /api/integration/google-calendar/:botId/connect
     * Returns the Google OAuth authorization URL. Called by frontend.
     */
    @ApiOperation({ summary: 'Start Google Calendar OAuth flow for a bot' })
    @ApiResponse({ status: 200, description: 'OAuth URL returned' })
    @UseGuards(AccessTokenGuard)
    @Post(':botId/connect')
    async connect(@Req() req, @Param('botId') botId: string) {
        const user = req.user as IUser;
        const authUrl = this.googleCalendarService.getAuthUrl(user.teamId, botId);
        return { authUrl };
    }

    /**
     * GET /api/integration/google-calendar/callback
     * Google redirects here after user consents. Exchanges code for tokens.
     */
    @ApiOperation({ summary: 'Google OAuth callback' })
    @Get('callback')
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: Response,
    ) {
        const result = await this.googleCalendarService.handleCallback(code, state);

        // Redirect back to the bot's integrations page in the frontend
        const frontendUrl =
            this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
        return res.redirect(
            `${frontendUrl}/integrations?google_calendar=connected&botId=${result.botId}`,
        );
    }

    /**
     * GET /api/integration/google-calendar/:botId
     * MCP-facing endpoint. Returns fresh access_token for a bot.
     * Auth: X-Internal-Key header (service-to-service).
     */
    @ApiOperation({ summary: 'Get Google Calendar token for bot (internal)' })
    @ApiResponse({ status: 200, description: 'Token returned' })
    @ApiResponse({ status: 404, description: 'Not configured' })
    @ApiResponse({ status: 410, description: 'Token revoked' })
    @UseGuards(InternalApiKeyGuard)
    @Get(':botId')
    async getToken(@Param('botId') botId: string) {
        return this.googleCalendarService.getTokenForBot(botId);
    }

    /**
     * GET /api/integration/google-calendar/:botId/status
     * Frontend-facing: returns connection status for a bot.
     */
    @ApiOperation({ summary: 'Get Google Calendar connection status' })
    @UseGuards(AccessTokenGuard)
    @Get(':botId/status')
    async getStatus(@Req() req, @Param('botId') botId: string) {
        const user = req.user as IUser;
        return this.googleCalendarService.getStatus(user.teamId, botId);
    }

    /**
     * DELETE /api/integration/google-calendar/:botId
     * Disconnect: revoke token and delete integration row.
     */
    @ApiOperation({ summary: 'Disconnect Google Calendar for a bot' })
    @UseGuards(AccessTokenGuard)
    @Delete(':botId')
    async disconnect(@Req() req, @Param('botId') botId: string) {
        const user = req.user as IUser;
        return this.googleCalendarService.disconnect(user.teamId, botId);
    }
}
