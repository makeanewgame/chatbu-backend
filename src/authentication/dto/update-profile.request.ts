import { IsNotEmpty, IsOptional, IsString, MaxLength } from '@nestjs/class-validator';

/**
 * Body for `PUT /auth/profile`. `@Body() body: any` previously skipped
 * validation entirely, so a profile could be saved with a non-email string
 * (e.g. a plain name) in the email field.
 *
 * Email is intentionally absent: changing it goes through the verified
 * two-step flow (`POST /auth/email-change/request` + `/confirm`). Any `email`
 * a client still sends is dropped by the whitelist validation pipe.
 */
export class UpdateProfileRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phoneNumber?: string;
}
