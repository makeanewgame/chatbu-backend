import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;
const MAX_MESSAGES_PER_REQUEST = 100;

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default';
}

interface ExpoPushTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

function isExpoPushToken(token: string): boolean {
    return EXPO_PUSH_TOKEN_REGEX.test(token);
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

@Injectable()
export class PushNotificationService {
    constructor(
        private prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    async registerToken(userId: string, dto: RegisterPushTokenDto) {
        if (!isExpoPushToken(dto.token)) {
            throw new BadRequestException('Invalid Expo push token');
        }

        return this.prisma.pushToken.upsert({
            where: { token: dto.token },
            update: { userId, platform: dto.platform },
            create: { userId, token: dto.token, platform: dto.platform },
        });
    }

    async removeToken(userId: string, token: string) {
        await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    }

    /**
     * Best-effort fan-out: failures for one user/token must not block others,
     * since this always runs alongside an email/socket notification that already
     * carries the event. Talks to Expo's push API directly over HTTP instead of
     * via the `expo-server-sdk` package, which ships ESM-only and cannot be
     * `require()`d from this CommonJS NestJS build (broke both `nest start`
     * and Jest when tried).
     */
    async sendToUsers(userIds: string[], notification: PushNotificationPayload) {
        const uniqueUserIds = [...new Set(userIds)];
        if (uniqueUserIds.length === 0) return;

        const tokens = await this.prisma.pushToken.findMany({
            where: { userId: { in: uniqueUserIds } },
        });
        if (tokens.length === 0) return;

        const messages: ExpoPushMessage[] = [];
        for (const t of tokens) {
            if (!isExpoPushToken(t.token)) {
                this.logger.warn(`Dropping malformed push token for user ${t.userId}`);
                continue;
            }
            messages.push({
                to: t.token,
                sound: 'default',
                title: notification.title,
                body: notification.body,
                data: notification.data ?? {},
            });
        }
        if (messages.length === 0) return;

        const staleTokens: string[] = [];

        for (const batch of chunk(messages, MAX_MESSAGES_PER_REQUEST)) {
            try {
                const response = await fetch(EXPO_PUSH_API_URL, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(batch),
                });
                const json = (await response.json()) as { data?: ExpoPushTicket[] };
                const tickets = json.data ?? [];
                tickets.forEach((ticket, i) => {
                    if (ticket.status === 'error') {
                        this.logger.warn(`Expo push ticket error: ${ticket.message}`);
                        if (ticket.details?.error === 'DeviceNotRegistered') {
                            staleTokens.push(batch[i].to);
                        }
                    }
                });
            } catch (error) {
                this.logger.error(`Failed to send push notification batch: ${error}`);
            }
        }

        if (staleTokens.length > 0) {
            await this.prisma.pushToken.deleteMany({ where: { token: { in: staleTokens } } });
        }
    }

    async sendToUser(userId: string, notification: PushNotificationPayload) {
        return this.sendToUsers([userId], notification);
    }
}
