import { IsIn, IsString } from 'class-validator';

export class MarkLeadStatusDto {
  @IsString()
  leadId: string;

  @IsIn(['READ', 'ARCHIVED'])
  status: 'READ' | 'ARCHIVED';
}
