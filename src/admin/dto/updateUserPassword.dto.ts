import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateUserPasswordDto {
    @ApiProperty({ required: true, description: 'New password for user' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;
}
