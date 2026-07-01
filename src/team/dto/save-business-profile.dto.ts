import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { CompanySize } from 'src/util/enums';

export class SaveBusinessProfileDto {
    @IsOptional()
    @IsString()
    businessName?: string;

    @IsOptional()
    @IsEnum(CompanySize)
    companySize?: CompanySize;

    @IsOptional()
    @IsString()
    industry?: string;

    @IsOptional()
    @IsUrl({ require_tld: false })
    website?: string;
}
