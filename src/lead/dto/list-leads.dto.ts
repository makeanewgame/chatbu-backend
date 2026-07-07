import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListLeadsDto {
  @IsString()
  botId: string;

  @IsOptional()
  @IsIn(['NEW', 'READ', 'ARCHIVED'])
  status?: 'NEW' | 'READ' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
