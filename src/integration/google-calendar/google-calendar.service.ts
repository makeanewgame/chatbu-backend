import {
    GoneException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from 'src/prisma/prisma.service';
import { SystemLogService } from 'src/system-log/system-log.service';

const INTEGRATION_TYPE = 'google-calendar';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class GoogleCalendarService {
    private oauth2Client: OAuth2Client;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private systemLogService: SystemLogService,
    ) {
        this.oauth2Client = new OAuth2Client(
            this.configService.get<string>('GOOGLE_CLIENT_ID'),
            this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
            this.configService.get<string>('GOOGLE_CALENDAR_REDIRECT_URI'),
        );
    }

    /**
     * Generate Google OAuth authorization URL for a specific bot.
     */
    getAuthUrl(teamId: string, botId: string): string {
        const state = Buffer.from(JSON.stringify({ teamId, botId })).toString(
            'base64url',
        );

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
            state,
        });
    }

    /**
     * Handle the OAuth callback: exchange code for tokens, store in Integrations.
     */
    async handleCallback(code: string, state: string) {
        const { teamId, botId } = JSON.parse(
            Buffer.from(state, 'base64url').toString('utf-8'),
        );

        const { tokens } = await this.oauth2Client.getToken(code);

        // Extract connected email from id_token if present
        let connectedEmail: string | undefined;
        if (tokens.id_token) {
            const ticket = await this.oauth2Client.verifyIdToken({
                idToken: tokens.id_token,
                audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
            });
            connectedEmail = ticket.getPayload()?.email;
        }

        const config = {
            botId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry: tokens.expiry_date
                ? new Date(tokens.expiry_date).toISOString()
                : null,
            calendar_id: 'primary',
            scopes: SCOPES,
            connected_email: connectedEmail || null,
            connected_at: new Date().toISOString(),
        };

        // Upsert: find existing row for this team+bot, update or create
        const existing = await this.findIntegration(teamId, botId);

        if (existing) {
            await this.prisma.integrations.update({
                where: { id: existing.id },
                data: { config },
            });
        } else {
            await this.prisma.integrations.create({
                data: {
                    teamId,
                    type: INTEGRATION_TYPE,
                    config,
                },
            });
        }

        await this.systemLogService.createLog({
            category: 'INTEGRATION',
            action: 'CREATE',
            status: 'SUCCESS',
            teamId,
            entityName: INTEGRATION_TYPE,
            message: `Google Calendar connected for bot ${botId}`,
        });

        return { teamId, botId };
    }

    /**
     * MCP-facing endpoint: return fresh access_token + calendar_id for a bot.
     * Proactively refreshes token if it expires within 5 minutes.
     */
    async getTokenForBot(botId: string) {
        // Find the integration row that has this botId in config
        const row = await this.prisma.integrations.findFirst({
            where: {
                type: INTEGRATION_TYPE,
                config: { path: ['botId'], equals: botId },
            },
        });

        if (!row) {
            throw new NotFoundException({
                error: 'not_configured',
                message:
                    'Google Calendar integration has not been set up for this bot.',
            });
        }

        const config = row.config as Record<string, any>;

        if (config.invalid) {
            throw new GoneException({
                error: 'token_revoked',
                message:
                    'The stored Google refresh token is no longer valid. User must reconnect.',
            });
        }

        // Check if token needs refresh
        const expiry = config.expiry ? new Date(config.expiry).getTime() : 0;
        const needsRefresh = Date.now() + EXPIRY_BUFFER_MS >= expiry;

        if (needsRefresh) {
            if (!config.refresh_token) {
                // Mark invalid — no refresh token available
                await this.markInvalid(row.id, config);
                throw new GoneException({
                    error: 'token_revoked',
                    message:
                        'The stored Google refresh token is no longer valid. User must reconnect.',
                });
            }

            try {
                this.oauth2Client.setCredentials({
                    refresh_token: config.refresh_token,
                });

                const { credentials } = await this.oauth2Client.refreshAccessToken();

                const updatedConfig: Record<string, any> = {
                    ...config,
                    access_token: credentials.access_token,
                    expiry: credentials.expiry_date
                        ? new Date(credentials.expiry_date).toISOString()
                        : config.expiry,
                };

                // Keep the new refresh_token if Google rotated it
                if (credentials.refresh_token) {
                    updatedConfig.refresh_token = credentials.refresh_token;
                }

                await this.prisma.integrations.update({
                    where: { id: row.id },
                    data: { config: updatedConfig },
                });

                return {
                    access_token: updatedConfig.access_token,
                    expiry: updatedConfig.expiry,
                    calendar_id: updatedConfig.calendar_id || 'primary',
                };
            } catch {
                await this.markInvalid(row.id, config);
                throw new GoneException({
                    error: 'token_revoked',
                    message:
                        'The stored Google refresh token is no longer valid. User must reconnect.',
                });
            }
        }

        return {
            access_token: config.access_token,
            expiry: config.expiry,
            calendar_id: config.calendar_id || 'primary',
        };
    }

    /**
     * Disconnect: revoke token at Google and delete the integration row.
     */
    async disconnect(teamId: string, botId: string) {
        const row = await this.findIntegration(teamId, botId);

        if (!row) {
            throw new NotFoundException('Google Calendar integration not found');
        }

        const config = row.config as Record<string, any>;

        // Attempt to revoke the token at Google (best-effort)
        if (config.access_token) {
            try {
                await this.oauth2Client.revokeToken(config.access_token);
            } catch {
                // Revocation failure is non-critical
            }
        }

        await this.prisma.integrations.delete({ where: { id: row.id } });

        await this.systemLogService.createLog({
            category: 'INTEGRATION',
            action: 'DELETE',
            status: 'SUCCESS',
            teamId,
            entityName: INTEGRATION_TYPE,
            message: `Google Calendar disconnected for bot ${botId}`,
        });

        return { success: true };
    }

    /**
     * Get the connection status for a specific bot (used by frontend).
     */
    async getStatus(teamId: string, botId: string) {
        const row = await this.findIntegration(teamId, botId);

        if (!row) {
            return { connected: false };
        }

        const config = row.config as Record<string, any>;

        return {
            connected: true,
            invalid: !!config.invalid,
            connected_email: config.connected_email || null,
            connected_at: config.connected_at || null,
            calendar_id: config.calendar_id || 'primary',
        };
    }

    private async findIntegration(teamId: string, botId: string) {
        return this.prisma.integrations.findFirst({
            where: {
                teamId,
                type: INTEGRATION_TYPE,
                config: { path: ['botId'], equals: botId },
            },
        });
    }

    private async markInvalid(id: string, config: Record<string, any>) {
        await this.prisma.integrations.update({
            where: { id },
            data: { config: { ...config, invalid: true } },
        });
    }
}
