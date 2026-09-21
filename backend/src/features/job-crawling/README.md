# Job crawling

Admin jobs/log reads are implemented. `domain/` now contains the legacy HTML
parser, stable job hashing, and source overrides. `CrawlIngestionService` exports
atomic persistence for parsed jobs/check timestamps/logs. No HTTP crawl endpoint
or scheduler is exposed yet.

The transport must bound bytes while reading, validate addresses and redirects,
and enforce timeouts before calling ingestion. See the backend developer guide
for transaction rules and remaining deadline/diagnostic requirements.
