import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteIntegrationDto {
    @IsString()
    @IsNotEmpty()
    id: string;
}
