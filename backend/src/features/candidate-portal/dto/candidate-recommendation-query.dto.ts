import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Keep personalized ranking responses small; the default matches the legacy dashboard. */
export class CandidateRecommendationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 8;
}
