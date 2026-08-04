import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum PushPlatform {
    IOS = 'ios',
    ANDROID = 'android',
}

export class RegisterPushTokenDto {
    @ApiProperty({
        description: 'Expo push token obtained on-device via getExpoPushTokenAsync',
        example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({
        description: 'Device platform',
        enum: PushPlatform,
        example: PushPlatform.IOS,
    })
    @IsEnum(PushPlatform)
    platform: PushPlatform;
}
