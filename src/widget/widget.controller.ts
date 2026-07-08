import { Body, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
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
            body.attachments,
        );
    }

    /**
     * Uploads a chat attachment (image or document).
     * Authenticated via sessionToken (2-hour JWT from /widget/session).
     * Throttled to 10 uploads/min per IP.
     */
    @ApiOperation({ summary: 'Upload a chat attachment through the widget' })
    @Post('uploadAttachment')
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    @UseInterceptors(FileInterceptor('file', {
        fileFilter: (_, file, cb) => {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
            cb(null, true);
        },
    }))
    async uploadAttachment(
        @Body('sessionToken') sessionToken: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.widgetService.uploadAttachment(sessionToken, file);
    }

    /**
     * Submits visitor feedback for a completed chat session.
     * Accepts either the current { answer: 'yes'|'partial'|'no', comment? }
     * shape or the legacy { rating: 1-5 } shape (older embedded widgets).
     * Throttled to 5 req/min per IP to prevent spam.
     */
    @ApiOperation({ summary: 'Submit visitor feedback for a chat' })
    @Post('feedback')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    async feedback(@Body() body: any) {
        return this.widgetService.submitFeedback(
            body.sessionToken,
            body.chatId,
            body.rating,
            body.answer,
            body.comment,
        );
    }
}
