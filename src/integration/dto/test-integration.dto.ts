import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TestIntegrationDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    dbName?: string;
}
