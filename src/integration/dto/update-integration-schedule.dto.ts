import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { IntegrationSchedule } from '../integration-schedule.constants';

export class UpdateIntegrationScheduleDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    // Shape validated imperatively by validateIntegrationSchedule() in the
    // service — see integration-schedule.constants.ts.
    @IsObject()
    schedule: IntegrationSchedule;
}
