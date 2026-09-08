import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from 'src/prisma/prisma.service';
import { DEFAULT_WORKING_HOURS, WorkingHours } from 'src/appointment/appointment.constants';
import {
    DEFAULT_FALLBACK_TIMEZONE,
    INTEGRATION_NIGHT_WINDOW,
    IntegrationSchedule,
} from './integration-schedule.constants';
import { isWithinWindow, isWithinWorkingHours } from './working-hours.util';

/** Minimal shape the webhook handlers already have in scope. */
export interface SchedulableIntegration {
    id: string;
    botId: string | null;
    schedule?: unknown;
}

@Injectable()
export class IntegrationScheduleService {
    private readonly logger = new Logger(IntegrationScheduleService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Should this integration auto-reply right now?
     *
     * A NULL / `always` schedule short-circuits to `true` without touching the
     * DB (the overwhelmingly common case). Any other mode resolves the bot's
     * `appointmentWorkingHours` as the "business hours" reference.
     *
     * Degrades OPEN: any unexpected error logs a warning and returns `true`, so
     * a malformed schedule never silently drops every inbound message on a
     * channel. Mirrors the never-throw posture of MetaLoopGuardService /
     * MetaAiDisclosureService.
     */
    async isIntegrationActive(
        integration: SchedulableIntegration,
        now: DateTime = DateTime.now(),
    ): Promise<boolean> {
        const schedule = this.parseSchedule(integration.schedule);
        if (!schedule || schedule.mode === 'always') return true;
        if (schedule.mode === 'off') return false;

        try {
            const businessHours = await this.resolveBusinessHours(integration.botId);
            const zone =
                schedule.timezone || businessHours.timezone || DEFAULT_FALLBACK_TIMEZONE;
            const localNow = now.setZone(zone);

            switch (schedule.mode) {
                case 'business_hours':
                    return isWithinWorkingHours(businessHours, localNow);
                case 'outside_business_hours':
                    return !isWithinWorkingHours(businessHours, localNow);
                case 'weekends':
                    return localNow.weekday >= 6; // Saturday (6) / Sunday (7)
                case 'nights':
                    return isWithinWindow(
                        INTEGRATION_NIGHT_WINDOW.start,
                        INTEGRATION_NIGHT_WINDOW.end,
                        localNow,
                    );
                case 'custom':
                    return schedule.days
                        ? isWithinWorkingHours({ ...businessHours, days: schedule.days }, localNow)
                        : true;
                default:
                    return true;
            }
        } catch (err) {
            this.logger.warn(
                `isIntegrationActive: falling back to ACTIVE for integration ${integration.id}: ${err?.toString()}`,
            );
            return true;
        }
    }

    private parseSchedule(raw: unknown): IntegrationSchedule | null {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        if (!(raw as { mode?: unknown }).mode) return null;
        return raw as IntegrationSchedule;
    }

    private async resolveBusinessHours(botId: string | null): Promise<WorkingHours> {
        if (!botId) return DEFAULT_WORKING_HOURS;
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId },
            select: { appointmentWorkingHours: true },
        });
        return (
            (bot?.appointmentWorkingHours as unknown as WorkingHours) ?? DEFAULT_WORKING_HOURS
        );
    }
}
