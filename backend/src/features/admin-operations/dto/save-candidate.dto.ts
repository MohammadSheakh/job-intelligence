import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Validates the full administrator candidate form; password omission preserves existing
 * credentials on update.
 */
export class SaveCandidateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

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
  @IsString()
  @MaxLength(1000)
  preferredLocations?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excludedLocations?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  preferredWorkModes?: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredCategories!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  excludedCategories!: string[];

  @IsInt()
  @Min(0)
  @Max(100)
  minimumMatchScore!: number;

  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  newPassword?: string;
}
