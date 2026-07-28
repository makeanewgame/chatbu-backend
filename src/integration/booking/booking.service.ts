import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SmsService } from 'src/sms/sms.service';

const CODE_TTL_MINUTES = 10;
const VERIFICATION_TOKEN_TTL_SECONDS = 5 * 60;
const MAX_CODE_REQUESTS_PER_HOUR = 5;

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly sms: SmsService,
        private readonly jwt: JwtService,
    ) { }

    /**
     * Generate a 6-digit code, persist it, and email the user.
     * Throws if the email has already requested too many codes this hour.
     */
    async requestVerification(email: string, botCuid: string) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await this.prisma.bookingVerification.count({
            where: { email, botCuid, createdAt: { gte: oneHourAgo } },
        });
        if (recentCount >= MAX_CODE_REQUESTS_PER_HOUR) {
            this.logger.warn(`Too many verification requests for ${email} on bot ${botCuid}`);
            throw new Error('TOO_MANY_REQUESTS');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

        const record = await this.prisma.bookingVerification.create({
            data: { email, botCuid, code, expiresAt },
        });

        // Look up bot display name for the email subject/body. Fail soft if not found.
        let botName = 'our team';
        try {
            const bot = await this.prisma.customerBots.findUnique({
                where: { id: botCuid },
                select: { botName: true },
            });
            if (bot?.botName) botName = bot.botName;
        } catch (e) {
            this.logger.warn(`Could not look up bot name for ${botCuid}: ${e}`);
        }

        await this.mail.sendBookingVerificationMail(email, code, botName, 'en');

        return {
            verificationId: record.id,
            expiresInSeconds: CODE_TTL_MINUTES * 60,
        };
    }

    /**
     * Validate a code. Marks the matching record `used=true` so it can't be replayed.
     * Returns a short-lived signed JWT that mcp-server passes to create_appointment.
     */
    async verify(email: string, code: string, botCuid: string) {
        const record = await this.prisma.bookingVerification.findFirst({
            where: {
                email,
                code,
                botCuid,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!record) {
            return { verified: false as const };
        }

        await this.prisma.bookingVerification.update({
            where: { id: record.id },
            data: { used: true },
        });

        const verificationToken = await this.jwt.signAsync(
            { email, botCuid, kind: 'booking', sub: record.id },
            {
                secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
                expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
            },
        );

        return { verified: true as const, verificationToken };
    }

    /**
     * Verify a JWT issued by `verify()`. Returns the payload if valid, throws if not.
     * mcp-server's create_appointment calls this before creating the calendar event.
     * Rejects tokens issued for a different purpose (e.g. lead verification) via `kind`.
     */
    async checkToken(token: string, email: string, botCuid: string) {
        const payload = await this.jwt.verifyAsync<{ email: string; botCuid: string; kind?: string; sub: string }>(
            token,
            { secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET },
        );
        if (payload.email !== email || payload.botCuid !== botCuid || payload.kind !== 'booking') {
            throw new Error('TOKEN_MISMATCH');
        }
        return payload;
    }

    // ---------------------------------------------------------------------
    // SMS-based verification (Faz B of SMS-booking migration)
    //
    // Parallel-shipping alongside the email methods above so the MCP tools
    // (Faz C) can flip over in a subsequent deploy without a
    // backend-down-then-mcp-catch-up gap. Once every MCP client is on the
    // SMS routes the email methods + BookingVerification table drop in a
    // later cleanup cycle.
    //
    // Same overall shape as the email flow:
    //   1. requestSmsVerification(phone, botCuid) — generate + persist code,
    //      SMS it via SmsService.sendOtpSms.
    //   2. verifySms(phone, code, botCuid) — mark used, issue kind:'booking'
    //      JWT scoped to `phone` (not `email`).
    //   3. checkSmsToken(token, phone, botCuid) — validate JWT, phone must
    //      match, kind must be 'booking'.
    //
    // Rate limit unchanged: 5 requests / hour / (phone, botCuid).
    // ---------------------------------------------------------------------

    /**
     * Generate a 6-digit code, persist it in `BookingSmsVerification`, and
     * send it as an SMS via the shared NETGSM `SmsService`. Rate-limited to
     * 5 requests per (phone, botCuid) per rolling hour to avoid using SMS
     * credit as a DoS surface. Throws 'TOO_MANY_REQUESTS' when the cap
     * fires; caller (BookingController.request) translates that to
     * HTTP 429.
     */
    async requestSmsVerification(phone: string, botCuid: string) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await this.prisma.bookingSmsVerification.count({
            where: { phone, botCuid, createdAt: { gte: oneHourAgo } },
        });
        if (recentCount >= MAX_CODE_REQUESTS_PER_HOUR) {
            this.logger.warn(`Too many SMS verification requests for ${phone} on bot ${botCuid}`);
            throw new Error('TOO_MANY_REQUESTS');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

        const record = await this.prisma.bookingSmsVerification.create({
            data: { phone, botCuid, code, expiresAt },
        });

        // Fetch bot display name for the SMS body. Fail soft if not found —
        // the visitor still gets a code, just with the generic 'our team'
        // label; same behaviour as the email path above.
        let botName = 'our team';
        try {
            const bot = await this.prisma.customerBots.findUnique({
                where: { id: botCuid },
                select: { botName: true },
            });
            if (bot?.botName) botName = bot.botName;
        } catch (e) {
            this.logger.warn(`Could not look up bot name for ${botCuid}: ${e}`);
        }

        // Language selection is intentionally kept simple here: default to
        // Turkish. The gateway's LanguageEnforcementMiddleware handles
        // language on the reply-side; SMS text is short and templated, so
        // per-visitor language routing lives on the caller side once we
        // have a signal (Faz C will pass it through from the MCP tool call
        // context). Fail-open on SMS transport error: caller of this
        // method treats any throw as a 500 to the MCP, which surfaces as
        // BOOKING_VERIFICATION_RATE_LIMITED / _FAILED sentinel back to the
        // agent — same failure surface the email path already produces.
        await this.sms.sendOtpSms(phone, code, botName, 'tr');

        return {
            verificationId: record.id,
            expiresInSeconds: CODE_TTL_MINUTES * 60,
        };
    }

    /**
     * Validate an SMS-issued code. Marks the matching record `used=true` so
     * it can't be replayed. Returns a short-lived signed JWT scoped to the
     * verified phone number; mcp-server's create_appointment passes that
     * JWT (or the raw code) to `checkSmsToken` before actually creating a
     * calendar event.
     *
     * JWT payload uses `phone` in place of the email path's `email`. Both
     * carry `kind: 'booking'` — the two flows share a single "booking token"
     * type, differing only in the identity field, so downstream callers
     * shouldn't have to know which flow the token came from beyond the
     * one they were designed for.
     */
    async verifySms(phone: string, code: string, botCuid: string) {
        const record = await this.prisma.bookingSmsVerification.findFirst({
            where: {
                phone,
                code,
                botCuid,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!record) {
            return { verified: false as const };
        }

        await this.prisma.bookingSmsVerification.update({
            where: { id: record.id },
            data: { used: true },
        });

        const verificationToken = await this.jwt.signAsync(
            { phone, botCuid, kind: 'booking', sub: record.id },
            {
                secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
                expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
            },
        );

        return { verified: true as const, verificationToken };
    }

    /**
     * Verify a JWT issued by `verifySms()`. Phone-scoped counterpart of
     * `checkToken()`. Same `kind: 'booking'` gate — rejects tokens issued
     * for lead verification or any other purpose, and rejects tokens
     * without a `kind` at all (defense against pre-migration tokens).
     */
    async checkSmsToken(token: string, phone: string, botCuid: string) {
        const payload = await this.jwt.verifyAsync<{ phone: string; botCuid: string; kind?: string; sub: string }>(
            token,
            { secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET },
        );
        if (payload.phone !== phone || payload.botCuid !== botCuid || payload.kind !== 'booking') {
            throw new Error('TOKEN_MISMATCH');
        }
        return payload;
    }
}
