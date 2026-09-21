# Job crawling

Admin jobs/log reads are implemented. `domain/` now contains the legacy HTML
parser, stable job hashing, and source overrides. `CrawlIngestionService` exports
atomic persistence for parsed jobs/check timestamps/logs. `CareerPageFetcherService` exports bounded public HTTP(S) fetching. No HTTP crawl endpoint
or scheduler is exposed yet.

The transport bounds bytes while reading, validates addresses and redirects,
and enforces a shared timeout. The future orchestrator must call it before ingestion. See the backend developer guide
for transaction rules and remaining deadline/diagnostic requirements.
