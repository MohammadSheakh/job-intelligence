import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Validates pipeline form values; defaults and date-preservation behavior are applied by the
 * service.
 */
export class SaveCompanyStateDto {
  @IsString()
  @MaxLength(80)
  companyId!: string;

  @IsIn(['PLANNING', 'APPLIED', 'EXCLUDED'])
  status!: 'PLANNING' | 'APPLIED' | 'EXCLUDED';

  @IsOptional()
  @IsDateString()
  lastAppliedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  reapplyCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
