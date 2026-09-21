import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

/** Validates the complete editable settings form with legacy numeric bounds. */
export class UpdateSettingsDto {
  @IsBoolean()
  aiEnabled!: boolean;

  @IsString()
  @MaxLength(120)
  aiProvider!: string;

  @IsInt()
  @Min(0)
  aiDailyLimit!: number;

  @IsBoolean()
  aiMatchingEnabled!: boolean;

  @IsBoolean()
  aiSkillExtractionEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  defaultMatchThreshold!: number;

  @IsBoolean()
  emailEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(20)
  quickSearchDailyLimit!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  quickSearchAiDailyLimit!: number;

  @IsInt()
  @Min(1)
  @Max(25)
  quickSearchCompanyLimit!: number;
}
