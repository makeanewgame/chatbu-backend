import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';

export class UpdateUserDto {
    @ApiProperty({ required: false, description: 'User name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false, description: 'User email' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ required: false, description: 'User phone number' })
    @IsOptional()
    @IsString()
    phonenumber?: string;

    @ApiProperty({ required: false, description: 'User role' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiProperty({ required: false, description: 'Email verified status' })
    @IsOptional()
    @IsBoolean()
    emailVerified?: boolean;

    @ApiProperty({ required: false, description: 'Phone verified status' })
    @IsOptional()
    @IsBoolean()
    phoneVerified?: boolean;
}
