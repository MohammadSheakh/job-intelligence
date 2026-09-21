import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const actions = [
  'MONITOR_READY',
  'FIND_CAREER_PAGE',
  'NO_HIRING_PAGE_FOUND',
  'ENRICH_FROM_LINKEDIN',
  'MANUAL_REVIEW',
] as const;

export class UpdateCompanyDto {
  @IsString()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  careerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  linkedinUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  techStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @IsOptional()
  @IsIn(actions)
  recommendedAction?: (typeof actions)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusResearchHint?: string;

  @IsBoolean()
  active!: boolean;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  categories!: string[];
}
