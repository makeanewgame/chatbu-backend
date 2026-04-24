export class CreatePricePlanDto {
    monthlyBaseUsd: number;
    yearlyBaseUsd: number;
    tokenPer1000Usd: number;
}

export class PublishPricePlanDto {
    confirmationText: string; // "ONAYLA" gelmeli
}
