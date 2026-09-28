import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const actions = [
  'MONITOR_READY',
  'FIND_CAREER_PAGE',
  'NO_HIRING_PAGE_FOUND',
  'ENRICH_FROM_LINKEDIN',
  'MANUAL_REVIEW',
  'DISCOVERED_CAREER_URL',
  'DISCOVERED_WEBSITE_ONLY',
  'NO_WEBSITE_FOUND',
] as const;

/** Bounds administrator company pagination and restricts research-action filters. */
export class CompanyListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(actions)
  action?: (typeof actions)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  needsManualReview?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
