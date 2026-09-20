import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class SaveCompanyStateDto {
  @IsString() @MaxLength(80) companyId!: string;
  @IsIn(['PLANNING', 'APPLIED', 'EXCLUDED']) status!: 'PLANNING' | 'APPLIED' | 'EXCLUDED';
  @IsOptional() @IsDateString() lastAppliedAt?: string;
  @IsOptional() @IsInt() @Min(0) reapplyCount?: number;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
