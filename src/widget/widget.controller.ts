import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { WidgetService } from './widget.service';

@ApiTags('Widget')
@Controller('widget')
export class WidgetController {
    constructor(private widgetService: WidgetService) { }

    /**
     * Creates or refreshes a visitor session.
     * Stricter throttle (5 req/min per IP) prevents session farming.
     * The server fingerprint ensures the same visitor is always resolved
     * even if the client deletes its localStorage.
     */
    @ApiOperation({ summary: 'Create or refresh a widget visitor session' })
    @Post('session')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    async session(@Body() body: any, @Req() req: Request) {
        const ip =
            ((req.headers['x-forwarded-for'] as string) ?? '')
                .split(',')[0]
                .trim() || req.socket?.remoteAddress || '127.0.0.1';

        return this.widgetService.createSession(
            body.token,
            ip,
            req.headers['user-agent'] ?? '',
            req.headers['accept-language'] ?? '',
            req.headers['origin'] as string | undefined,
            req.headers['referer'] as string | undefined,
        );
    }

    /**
     * Sends a chat message.
     * Throttled to 20 req/min per IP (additional layer on top of visitor daily limits).
     */
    @ApiOperation({ summary: 'Send a chat message through the widget' })
    @Post('chat')
    @Throttle({ default: { ttl: 60000, limit: 20 } })
    async chat(@Body() body: any, @Req() req: Request) {
        const ip =
            ((req.headers['x-forwarded-for'] as string) ?? '')
                .split(',')[0]
                .trim() || req.socket?.remoteAddress || '127.0.0.1';

        return this.widgetService.chat(
            body.sessionToken,
            body.message,
            body.chatId,
            ip,
        );
    }
}
