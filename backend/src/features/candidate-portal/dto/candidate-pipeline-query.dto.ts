import { IsIn, IsOptional } from 'class-validator';
export class CandidatePipelineQueryDto {
  @IsOptional() @IsIn(['PLANNING', 'APPLIED', 'EXCLUDED'])
  status?: 'PLANNING' | 'APPLIED' | 'EXCLUDED';
}
