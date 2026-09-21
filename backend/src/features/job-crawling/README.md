# Job crawling

`CrawlExecutionModule` shares public HTTP transport, HTML parsing, atomic ingestion,
and source orchestration between the API and a minimal daily worker context.
Admin jobs/log endpoints remain in `JobCrawlingModule`.

From the repo root, build with `pnpm --dir backend build`, then inspect
`pnpm --dir backend crawl:daily --help`. Invoking without `--help` crawls sites
and writes to the configured database. No scheduler is installed by this command.

The worker uses bounded 50-company batches, sequential fetching, a 750 ms default
delay (`CRAWL_DELAY_MS`), optional `CRAWL_LIMIT`, and a direct PostgreSQL session
lock. For pooled application connections, configure `CRAWLER_LOCK_DATABASE_URL`
to the same database using a direct endpoint. Do not overlap legacy daily runs.

See `docs/BACKEND_DEVELOPER_GUIDE.md` for ownership, shutdown, failure semantics,
and remaining Quick Search/deployment work. No live execution has been verified.
