import { IsIn } from 'class-validator';

/** Validates on-demand quick search execution parameters. */
export class ExecuteQuickSearchDto {
  @IsIn(['STANDARD', 'AI'])
  mode: 'STANDARD' | 'AI' = 'STANDARD';
}
