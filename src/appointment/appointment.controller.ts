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
import { IsEmail, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InternalApiKeyGuard } from '../integration/google-calendar/internal-api-key.guard';
import { AppointmentService } from './appointment.service';

/**
 * DTO for the MCP `/appointment-created` hop. Every field except
 * `description` and `lang` is required — the MCP tool controls the
 * whole payload, so missing pieces indicate an agent argument bug that
 * we want to surface loudly (400) rather than persisting a half-record.
 *
 * `class-validator` decorators on top of the same whitelist ValidationPipe
 * booking uses — see BookingController for the 2026-06-12 gotcha
 * (missing decorators → empty body → confusing 400s).
 */
class AppointmentCreatedDto {
    @IsString()
    @IsNotEmpty()
    botCuid!: string;

    @IsString()
    @IsNotEmpty()
    calendarEventId!: string;

    @IsString()
    @IsNotEmpty()
    attendeeName!: string;

    @IsString()
    @IsNotEmpty()
    attendeePhone!: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    attendeeEmail!: string;

    @IsISO8601()
    startIso!: string;

    @IsISO8601()
    endIso!: string;

    @IsString()
    @IsNotEmpty()
    summary!: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsNotEmpty()
    timezone!: string;

    @IsOptional()
    @IsIn(['tr', 'en'])
    lang?: 'tr' | 'en';
}

@ApiTags('Appointment (internal)')
@Controller('integration/booking')
@UseGuards(InternalApiKeyGuard)
export class AppointmentController {
    constructor(private readonly appointment: AppointmentService) { }

    /**
     * POST /api/integration/booking/appointment-created
     *
     * mcp-server calls this right after a successful `events.insert` on
     * Google Calendar. Fail-open contract: any exception here is
     * caught by the MCP side's belt+suspenders wrapper so the visitor's
     * confirmation of "your appointment is booked" isn't blocked by a
     * bookkeeping hop. 200 on both first-time insert and idempotent
     * duplicate (see AppointmentService.createFromMcp).
     */
    @ApiOperation({ summary: 'Persist a completed booking + send confirmation SMS (internal)' })
    @ApiResponse({ status: 200, description: 'Persisted (first time or duplicate)' })
    @Post('appointment-created')
    @HttpCode(200)
    async appointmentCreated(@Body() body: AppointmentCreatedDto) {
        try {
            return await this.appointment.createFromMcp(body);
        } catch (e) {
            // The service raises on genuinely-malformed input (bad ISO
            // date shape that class-validator's @IsISO8601 didn't catch,
            // e.g. an in-range but semantically weird date). Surface it
            // as 400 so the MCP hop's wrapper can bucket + log without
            // eating it silently.
            throw new HttpException(
                (e as Error).message ?? 'appointment persistence failed',
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}
