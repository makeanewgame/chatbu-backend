import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

const CODE_TTL_MINUTES = 10;
const VERIFICATION_TOKEN_TTL_SECONDS = 5 * 60;
const MAX_CODE_REQUESTS_PER_HOUR = 5;

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
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

        await this.mail.sendBookingVerificationMail(email, code, botName);

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
            { email, botCuid, sub: record.id },
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
     */
    async checkToken(token: string, email: string, botCuid: string) {
        const payload = await this.jwt.verifyAsync<{ email: string; botCuid: string; sub: string }>(
            token,
            { secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET },
        );
        if (payload.email !== email || payload.botCuid !== botCuid) {
            throw new Error('TOKEN_MISMATCH');
        }
        return payload;
    }
}
