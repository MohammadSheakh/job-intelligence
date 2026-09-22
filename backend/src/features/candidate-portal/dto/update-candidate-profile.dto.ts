import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Allows self-service profile fields only; email and candidate identity are intentionally
 * excluded.
 */
export class UpdateCandidateProfileDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  expertise?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  skills?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  experienceLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  preferredLocations?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excludedLocations?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['Remote', 'Hybrid', 'On-site'], { each: true })
  preferredWorkModes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCategories?: string[];

  @IsInt()
  @Min(0)
  @Max(100)
  minimumMatchScore!: number;
}
