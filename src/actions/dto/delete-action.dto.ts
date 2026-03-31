import { IsString, IsNotEmpty } from '@nestjs/class-validator';

export class DeleteActionDto {
    @IsString()
    @IsNotEmpty()
    id: string;
}
