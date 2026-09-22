import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional URL overrides when triggering company enrichment. */
export class EnrichCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  careerUrl?: string;
}
