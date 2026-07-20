import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeMetaCodeDto {
    @IsString()
    @IsNotEmpty()
    chatbotId: string;

    @IsString()
    @IsNotEmpty()
    authorizationCode: string;
}
