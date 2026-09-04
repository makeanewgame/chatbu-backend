import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminUserDto {
    @ApiProperty({ description: 'User full name' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'User email address' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Initial password (min 8 chars)' })
    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({ required: false, description: 'Phone number' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiProperty({ required: false, description: 'User role', default: 'USER' })
    @IsOptional()
    @IsString()
    role?: string;
}
