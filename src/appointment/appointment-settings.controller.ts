import {
    Body,
    Controller,
    ForbiddenException,
    HttpCode,
    NotFoundException,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsString,
} from 'class-validator';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { IUser } from 'src/util/interfaces';
import { AppointmentService } from './appointment.service';
import { AppointmentAvailabilityService } from './appointment-availability.service';
import { WorkingHours } from './appointment.constants';

class GetAvailabilityDto {
    @IsString()
    @IsNotEmpty()
    botId!: string;
}

/**
 * DTO for the FE bot-settings surface. `offsets` mirrors the two
 * checkboxes the UI exposes today (24h before / 1h before). Owner can
 * uncheck both to disable reminders entirely for the bot (empty array).
 * class-validator caps at 2 items — any additional offset value must
 * come with a new checkbox on the FE and a widening of both this cap
 * AND the ALLOWED_REMINDER_OFFSETS set in AppointmentService.
 */
class UpdateReminderOffsetsDto {
    @IsString()
    @IsNotEmpty()
    botId!: string;

    @IsArray()
    @IsInt({ each: true })
    @ArrayMinSize(0)
    @ArrayMaxSize(2)
    @ArrayUnique()
    offsets!: number[];
}

/**
 * DTO for the FE working-hours form (inline calendar picker, Faz 1).
 * `workingHours` is validated imperatively in AppointmentService — see
 * `validateWorkingHours` — rather than via a nested class-validator tree,
 * matching the `settings: Json?` precedent elsewhere on this model.
 */
class UpdateWorkingHoursDto {
    @IsString()
    @IsNotEmpty()
    botId!: string;

    @IsObject()
    workingHours!: WorkingHours;
}

/**
 * FE-facing controller for bot appointment settings. Separate class
 * from AppointmentController (MCP-internal) so guards can't blur — this
 * one uses AccessTokenGuard (JWT auth), the internal one uses
 * InternalApiKeyGuard. Mounted under `/bot` rather than `/appointment`
 * so the FE bot-settings page hits the same URL family it already
 * uses for updateSmsVerification / updateLeadDestinations / etc.
 */
@ApiTags('Bot appointment settings')
@Controller('bot')
export class AppointmentSettingsController {
    constructor(
        private readonly appointment: AppointmentService,
        private readonly appointmentAvailability: AppointmentAvailabilityService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * POST /api/bot/updateAppointmentReminderOffsets
     * Body: { botId: string, offsets: number[] }
     * Response: { id: string, appointmentReminderOffsets: number[] }
     *
     * Sample payloads:
     *   { botId: "...", offsets: [1440, 60] }  → both checkboxes on
     *   { botId: "...", offsets: [60] }        → only "1 hour before"
     *   { botId: "...", offsets: [] }          → reminders off for this bot
     */
    @ApiOperation({ summary: "Update per-bot appointment reminder offsets (24h / 1h / off)" })
    @ApiResponse({ status: 200, description: 'Offsets updated' })
    @ApiResponse({ status: 403, description: 'Unsupported offset or wrong team' })
    @ApiResponse({ status: 404, description: 'Bot not found' })
    @ApiBearerAuth()
    @Post('updateAppointmentReminderOffsets')
    @UseGuards(AccessTokenGuard)
    @HttpCode(200)
    async updateReminderOffsets(
        @Body() body: UpdateReminderOffsetsDto,
        @Req() req: Request,
    ) {
        const user = req.user as IUser;
        return this.appointment.updateReminderOffsets(
            body.botId,
            user.teamId,
            body.offsets,
        );
    }

    /**
     * POST /api/bot/updateAppointmentWorkingHours
     * Body: { botId: string, workingHours: WorkingHours }
     * Response: { id: string, appointmentWorkingHours: WorkingHours }
     */
    @ApiOperation({ summary: 'Update per-bot appointment working hours (inline calendar picker)' })
    @ApiResponse({ status: 200, description: 'Working hours updated' })
    @ApiResponse({ status: 403, description: 'Invalid working hours or wrong team' })
    @ApiResponse({ status: 404, description: 'Bot not found' })
    @ApiBearerAuth()
    @Post('updateAppointmentWorkingHours')
    @UseGuards(AccessTokenGuard)
    @HttpCode(200)
    async updateWorkingHours(
        @Body() body: UpdateWorkingHoursDto,
        @Req() req: Request,
    ) {
        const user = req.user as IUser;
        return this.appointment.updateWorkingHours(
            body.botId,
            user.teamId,
            body.workingHours,
        );
    }

    /**
     * POST /api/bot/appointment/availability
     * Body: { botId: string }
     * Response: AvailabilityResponse | AvailabilityError (see
     * AppointmentAvailabilityService.getAvailableSlots)
     *
     * Dashboard-authenticated counterpart to the widget's public
     * POST /widget/appointment/availability (widget.controller.ts), so the
     * "test your chatbot" panel's inline calendar picker can fetch the same
     * bookable slots without a widget session token — the AccessTokenGuard
     * JWT already authenticates the caller here.
     */
    @ApiOperation({ summary: 'Get bookable appointment slots for a bot (dashboard test-chat picker)' })
    @ApiResponse({ status: 200, description: 'Availability returned' })
    @ApiResponse({ status: 403, description: 'Wrong team' })
    @ApiResponse({ status: 404, description: 'Bot not found' })
    @ApiBearerAuth()
    @Post('appointment/availability')
    @UseGuards(AccessTokenGuard)
    @HttpCode(200)
    async getAvailability(
        @Body() body: GetAvailabilityDto,
        @Req() req: Request,
    ) {
        const user = req.user as IUser;
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: body.botId },
            select: { id: true, teamId: true },
        });
        if (!bot) {
            throw new NotFoundException(`Bot ${body.botId} not found`);
        }
        if (bot.teamId !== user.teamId) {
            throw new ForbiddenException(`Bot ${body.botId} does not belong to your team`);
        }
        return this.appointmentAvailability.getAvailableSlots(body.botId);
    }
}
