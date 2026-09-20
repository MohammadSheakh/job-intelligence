import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const actions = ['MONITOR_READY', 'FIND_CAREER_PAGE', 'NO_HIRING_PAGE_FOUND', 'ENRICH_FROM_LINKEDIN', 'MANUAL_REVIEW'] as const;

export class CompanyListQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(actions) action?: typeof actions[number];
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
