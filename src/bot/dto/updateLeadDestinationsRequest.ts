import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LEAD_CHANNELS, LeadChannel, MAX_LEAD_DESTINATIONS } from '../lead-destination.constants';

export class LeadDestinationDto {
  @IsIn(LEAD_CHANNELS as unknown as string[], { message: 'Invalid channel' })
  channel: LeadChannel;

  @IsEmail({}, { message: 'target must be a valid email address' })
  target: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateLeadDestinationsRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsArray()
  @ArrayMaxSize(MAX_LEAD_DESTINATIONS, {
    message: `A bot may have at most ${MAX_LEAD_DESTINATIONS} lead destinations`,
  })
  @ValidateNested({ each: true })
  @Type(() => LeadDestinationDto)
  destinations: LeadDestinationDto[];
}
