import { IsNumber, IsPositive, IsString } from 'class-validator';

export class CreatePricePlanDto {
    @IsNumber()
    @IsPositive()
    monthlyBaseUsd: number;

    @IsNumber()
    @IsPositive()
    yearlyBaseUsd: number;

    @IsNumber()
    @IsPositive()
    tokenPer1000Usd: number;
}

export class PublishPricePlanDto {
    @IsString()
    confirmationText: string; // "CONFIRM" gelmeli
}
