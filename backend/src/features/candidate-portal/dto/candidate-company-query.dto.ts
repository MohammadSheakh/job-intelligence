import { IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class CandidateCompanyQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 50;
}
