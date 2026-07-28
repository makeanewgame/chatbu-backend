import {
    Body,
    Controller,
    HttpCode,
    HttpException,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { InternalApiKeyGuard } from '../google-calendar/internal-api-key.guard';
import { BookingService } from './booking.service';

// main.ts registers a global ValidationPipe with `whitelist: true`. With
// that flag any property NOT declared via class-validator decorators is
// silently stripped from @Body() before the controller runs — so without
// these decorators every booking call arrived with body={}, the controller
// rejected it as "email and botCuid are required" (400), MCP mapped that
// to BOOKING_TOOL_ARGUMENT_ERROR, and the bot told the user calendar was
// down even though MCP, agent and Google Calendar were all fine. Observed
// 2026-06-12 on Veri Bilimi Okulu dev with curl-from-MCP-pod repro.
class RequestVerificationDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

class VerifyDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    code!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

class CheckTokenDto {
    @IsString()
    @IsNotEmpty()
    token!: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

// SMS-parallel DTOs for Faz B. Ship-together with the /request-sms-verification,
// /verify-sms, /check-sms-token routes below. `phone` is validated as a
// non-empty string only — the sharper Turkish-mobile shape check lives on
// the MCP side (Faz C) so a non-TR number never even reaches the backend;
// but keep the validator loose here so backend tests can exercise the
// controller without repro'ing the full MCP regex.
class RequestSmsVerificationDto {
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

class VerifySmsDto {
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @IsString()
    @IsNotEmpty()
    code!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

class CheckSmsTokenDto {
    @IsString()
    @IsNotEmpty()
    token!: string;

    @IsString()
    @IsNotEmpty()
    phone!: string;

    @IsString()
    @IsNotEmpty()
    botCuid!: string;
}

@ApiTags('Booking Verification (internal)')
@Controller('integration/booking')
@UseGuards(InternalApiKeyGuard)
export class BookingController {
    constructor(private readonly booking: BookingService) { }

    /**
     * POST /api/integration/booking/request-verification
     * mcp-server calls this when the agent wants to send a verification email.
     */
    @ApiOperation({ summary: 'Send a 6-digit verification code to the user (internal)' })
    @ApiResponse({ status: 200, description: 'Code sent' })
    @ApiResponse({ status: 429, description: 'Too many requests for this email' })
    @Throttle({ default: { ttl: 3600000, limit: 20 } }) // 20/hour at the controller level (per-email cap is in the service)
    @Post('request-verification')
    @HttpCode(200)
    async request(@Body() body: RequestVerificationDto) {
        if (!body.email || !body.botCuid) {
            throw new HttpException('email and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.booking.requestVerification(body.email, body.botCuid);
        } catch (e) {
            if ((e as Error).message === 'TOO_MANY_REQUESTS') {
                throw new HttpException('Too many code requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
            }
            throw e;
        }
    }

    /**
     * POST /api/integration/booking/verify
     * mcp-server calls this when the user provided a code in chat.
     * Returns a short-lived JWT used by create_appointment.
     */
    @ApiOperation({ summary: 'Verify a code and issue a booking token (internal)' })
    @ApiResponse({ status: 200, description: 'Verification result returned' })
    @Post('verify')
    @HttpCode(200)
    async verify(@Body() body: VerifyDto) {
        if (!body.email || !body.code || !body.botCuid) {
            throw new HttpException('email, code, and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        return this.booking.verify(body.email, body.code, body.botCuid);
    }

    /**
     * POST /api/integration/booking/check-token
     * mcp-server's create_appointment calls this before creating the calendar event.
     * Returns 200 if token is valid + matches the email/botCuid; throws otherwise.
     */
    @ApiOperation({ summary: 'Validate a booking verification JWT (internal)' })
    @ApiResponse({ status: 200, description: 'Token is valid' })
    @ApiResponse({ status: 401, description: 'Token invalid, expired, or mismatched' })
    @Post('check-token')
    @HttpCode(200)
    async checkToken(@Body() body: CheckTokenDto) {
        if (!body.token || !body.email || !body.botCuid) {
            throw new HttpException('token, email, and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        try {
            await this.booking.checkToken(body.token, body.email, body.botCuid);
            return { valid: true };
        } catch (e) {
            throw new HttpException('Invalid or expired booking token', HttpStatus.UNAUTHORIZED);
        }
    }

    // ---------------------------------------------------------------------
    // SMS-parallel routes (Faz B). Same three-step ceremony as the email
    // routes above, phone-scoped. Ship-together with Faz C which points
    // the MCP tools at these. Email routes stay live during the overlap
    // window so a rolling deploy can't strand any in-flight MCP callers;
    // both sets will be reconciled in a later cleanup cycle once the
    // email path drops to zero traffic.
    // ---------------------------------------------------------------------

    /**
     * POST /api/integration/booking/request-sms-verification
     * mcp-server calls this when the agent wants to send a verification
     * SMS to the visitor's phone.
     */
    @ApiOperation({ summary: 'Send a 6-digit verification code via SMS (internal)' })
    @ApiResponse({ status: 200, description: 'Code sent' })
    @ApiResponse({ status: 429, description: 'Too many requests for this phone' })
    @Throttle({ default: { ttl: 3600000, limit: 20 } })
    @Post('request-sms-verification')
    @HttpCode(200)
    async requestSms(@Body() body: RequestSmsVerificationDto) {
        if (!body.phone || !body.botCuid) {
            throw new HttpException('phone and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.booking.requestSmsVerification(body.phone, body.botCuid);
        } catch (e) {
            if ((e as Error).message === 'TOO_MANY_REQUESTS') {
                throw new HttpException('Too many code requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
            }
            throw e;
        }
    }

    /**
     * POST /api/integration/booking/verify-sms
     * mcp-server calls this when the user replied with the code they
     * received via SMS. Returns a short-lived JWT scoped to their phone,
     * used by create_appointment.
     */
    @ApiOperation({ summary: 'Verify an SMS code and issue a booking token (internal)' })
    @ApiResponse({ status: 200, description: 'Verification result returned' })
    @Post('verify-sms')
    @HttpCode(200)
    async verifySms(@Body() body: VerifySmsDto) {
        if (!body.phone || !body.code || !body.botCuid) {
            throw new HttpException('phone, code, and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        return this.booking.verifySms(body.phone, body.code, body.botCuid);
    }

    /**
     * POST /api/integration/booking/check-sms-token
     * mcp-server's create_appointment calls this before creating the
     * calendar event. Returns 200 if token is valid + matches the
     * phone/botCuid; throws 401 otherwise.
     */
    @ApiOperation({ summary: 'Validate a phone-scoped booking JWT (internal)' })
    @ApiResponse({ status: 200, description: 'Token is valid' })
    @ApiResponse({ status: 401, description: 'Token invalid, expired, or mismatched' })
    @Post('check-sms-token')
    @HttpCode(200)
    async checkSmsToken(@Body() body: CheckSmsTokenDto) {
        if (!body.token || !body.phone || !body.botCuid) {
            throw new HttpException('token, phone, and botCuid are required', HttpStatus.BAD_REQUEST);
        }
        try {
            await this.booking.checkSmsToken(body.token, body.phone, body.botCuid);
            return { valid: true };
        } catch (e) {
            throw new HttpException('Invalid or expired booking token', HttpStatus.UNAUTHORIZED);
        }
    }
}
