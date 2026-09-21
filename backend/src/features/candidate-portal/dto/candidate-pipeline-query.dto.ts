import { IsIn, IsOptional } from 'class-validator';

/** Restricts optional pipeline filtering to the three persisted workflow states. */
export class CandidatePipelineQueryDto {
  @IsOptional()
  @IsIn(['PLANNING', 'APPLIED', 'EXCLUDED'])
  status?: 'PLANNING' | 'APPLIED' | 'EXCLUDED';
}
