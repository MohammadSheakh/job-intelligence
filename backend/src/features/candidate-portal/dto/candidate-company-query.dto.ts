import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum CandidateTrackingFilter {
  ALL = 'ALL',
  PLANNING = 'PLANNING',
  APPLIED = 'APPLIED',
  EXCLUDED = 'EXCLUDED',
  UNTRACKED = 'UNTRACKED',
}

/** Bounds candidate company searches with pagination, text search, location, category, and personal tracking state filters. */
export class CandidateCompanyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsEnum(CandidateTrackingFilter)
  status?: CandidateTrackingFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
