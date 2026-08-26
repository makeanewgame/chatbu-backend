import { Body, Controller, Get, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { IUser } from 'src/util/interfaces';
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
     *
     * Content-type routing (voice agent plan Faz 2b PR 2, 2026-08-04):
     *   - `Accept: text/event-stream` → SSE stream via widgetService.chatStream
     *     (per-bot `streamingEnabled` gate enforced inside the service; a
     *     client that requests SSE for a batch-only bot gets a 400).
     *   - anything else → batch JSON via widgetService.chat (unchanged from
     *     pre-Faz-2b behavior; every widget in the wild that hasn't opted
     *     into streaming lands here byte-for-byte identically).
     *
     * `@Res({ passthrough: false })` on the SSE branch tells Nest we're
     * writing to the response directly — Nest must NOT auto-serialize the
     * return value. The batch branch still needs an explicit `res.json()`
     * because we lost the auto-serializer for the whole route.
     */
    @ApiOperation({ summary: 'Send a chat message through the widget' })
    @Post('chat')
    @Throttle({ default: { ttl: 60000, limit: 20 } })
    async chat(
        @Body() body: any,
        @Req() req: Request,
        @Res({ passthrough: false }) res: Response,
    ) {
        const ip =
            ((req.headers['x-forwarded-for'] as string) ?? '')
                .split(',')[0]
                .trim() || req.socket?.remoteAddress || '127.0.0.1';

        // Browser Accept-Language header — forwarded to gateway as
        // third-tier signal for the v2 hybrid language resolver
        // (falls behind session sticky + visitor_locale). The widget
        // fetch() sends this by default from the browser's language
        // preferences list; here we snapshot it into the RPC payload
        // so the gateway RequestState carries it explicitly rather
        // than relying on the header surviving proxy hops.
        const acceptLanguage =
            (req.headers['accept-language'] as string | undefined) ?? undefined;

        const wantsSse = (req.headers.accept ?? '')
            .toLowerCase()
            .includes('text/event-stream');

        if (wantsSse) {
            // chatStream writes SSE frames + ends the response itself;
            // we just await so throttle/logging/etc downstream in the
            // pipeline see the request has fully drained.
            await this.widgetService.chatStream(
                body.sessionToken,
                body.message,
                body.chatId,
                ip,
                res,
                body.attachments,
                body.provisionalConsentId,
                body.visitorLocale,
                acceptLanguage,
            );
            return;
        }

        const result = await this.widgetService.chat(
            body.sessionToken,
            body.message,
            body.chatId,
            ip,
            body.attachments,
            body.provisionalConsentId,
            body.visitorLocale,
            acceptLanguage,
        );
        res.status(200).json(result);
    }

    /**
     * Returns bookable appointment slots (working hours ∩ Google Calendar
     * freebusy) for the bot resolved from sessionToken — see
     * WidgetService.getAppointmentAvailability. Same throttle band as
     * /widget/chat since it's called right after the agent emits an
     * APPOINTMENT_BOOKING action, i.e. roughly once per booking attempt.
     */
    @ApiOperation({ summary: 'Get bookable appointment slots for the widget session\'s bot' })
    @Post('appointment/availability')
    @Throttle({ default: { ttl: 60000, limit: 20 } })
    async appointmentAvailability(@Body() body: any) {
        return this.widgetService.getAppointmentAvailability(body.sessionToken);
    }

    /**
     * Records that a widget visitor accepted the Privacy Notice + Terms
     * of Use, before their phone number is collected for SMS lead
     * verification. Public — bot-scoped only, no session token needed
     * since consent can happen before a chat message (and therefore a
     * session) even exists.
     *
     * Slice 3 (2026-08-20): canonical route is `/lead/privacy-consent`,
     * and the widget sends jurisdiction + locale in the body so the
     * persisted row reflects exactly what was shown. The legacy
     * `/lead/kvkk-consent` route below is a 30-day back-compat wrapper
     * that resolves jurisdiction server-side from Accept-Language + bot
     * default.
     */
    /**
     * Serve the consent-card text pack (title, intro, controller notice,
     * button labels, legal URLs) the widget should render.
     *
     * Jurisdiction + locale are resolved server-side from an optional
     * `locale` / `jurisdiction` query hint (widget's i18n.language), the
     * bot's `settings.defaultJurisdiction`, and the browser's
     * Accept-Language header. Response includes `jurisdiction` + `locale`
     * echoes so the widget can send them back on the follow-up POST for
     * exact-match audit persistence.
     *
     * Cache-Control: 5 min public. Text pack is fully derivable from
     * (botId, jurisdiction, locale), so per-visitor caches are safe.
     */
    @ApiOperation({ summary: 'Get Privacy Notice / Terms of Use text pack for widget render' })
    @Get('lead/privacy-consent-text')
    @Throttle({ default: { ttl: 60000, limit: 30 } })
    async getPrivacyConsentText(
        @Query('botId') botId: string,
        @Query('locale') locale: string | undefined,
        @Query('jurisdiction') jurisdiction: string | undefined,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return this.widgetService.getPrivacyConsentText(botId, {
            explicitLocale: locale ?? null,
            explicitJurisdiction: (jurisdiction as any) ?? null,
            acceptLanguage: (req.headers['accept-language'] as string) ?? null,
        });
    }

    @ApiOperation({ summary: 'Record Privacy Notice acceptance for SMS lead verification' })
    @Post('lead/privacy-consent')
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    async recordPrivacyConsent(@Body() body: any, @Req() req: Request) {
        const ip =
            ((req.headers['x-forwarded-for'] as string) ?? '')
                .split(',')[0]
                .trim() || req.socket?.remoteAddress || '127.0.0.1';

        return this.widgetService.recordKvkkConsent(
            body.botId,
            body.chatId,
            ip,
            (req.headers['user-agent'] as string) ?? '',
            body.locale,
            body.jurisdiction,
            (req.headers['accept-language'] as string) ?? undefined,
        );
    }

    /**
     * Deprecated 2026-08-20 (Slice 3) — kept for widget bundles shipped
     * before the rename. Delete after all live widgets have picked up
     * the `/lead/privacy-consent` canonical URL (~30 days). Same
     * behaviour as the canonical route; server-side jurisdiction
     * resolution kicks in because the legacy widget does not send
     * `locale` / `jurisdiction`.
     */
    @ApiOperation({ summary: '[DEPRECATED] Legacy KVKK consent route — use /lead/privacy-consent' })
    @Post('lead/kvkk-consent')
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    async recordKvkkConsent(@Body() body: any, @Req() req: Request) {
        const ip =
            ((req.headers['x-forwarded-for'] as string) ?? '')
                .split(',')[0]
                .trim() || req.socket?.remoteAddress || '127.0.0.1';

        return this.widgetService.recordKvkkConsent(
            body.botId,
            body.chatId,
            ip,
            (req.headers['user-agent'] as string) ?? '',
            body.locale,
            body.jurisdiction,
            (req.headers['accept-language'] as string) ?? undefined,
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

    /**
     * Same feedback flow as POST /widget/feedback, for the dashboard's own
     * internal "test your chatbot" panel (ChatForm.tsx) — an authenticated
     * dashboard user testing their own bot, not a widget visitor with a
     * sessionToken. Guarded per-route (this controller is otherwise public)
     * since it's the one dashboard-facing exception here.
     */
    @ApiOperation({ summary: 'Submit feedback for a chat from the dashboard test panel' })
    @Post('feedback-authenticated')
    @UseGuards(AccessTokenGuard)
    async feedbackAuthenticated(@Body() body: any, @Req() req: Request) {
        const user = req.user as IUser;
        return this.widgetService.submitFeedbackAuthenticated(
            body.botId,
            user.teamId,
            body.chatId,
            body.answer,
            body.comment,
        );
    }
}
