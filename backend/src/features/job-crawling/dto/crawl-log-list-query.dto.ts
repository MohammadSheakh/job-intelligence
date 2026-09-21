import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Bounds operational crawl-history pagination. */
export class CrawlLogListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 100;
}
