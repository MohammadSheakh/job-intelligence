# Backend developer guide

The replacement API lives in `backend/`. It is single-tenant: every request uses
the configured Prisma connection, while candidate-owned data is scoped by the
candidate ID loaded from the signed session. See `ARCHITECTURE_MIGRATION_STATUS.md`
for which features and verification steps have migrated.

## Following a request

`src/main.ts` installs the `/api/v1` prefix, credentialed CORS, and a strict global
validation pipe. Controllers handle HTTP concerns and delegate to services.
DTOs describe accepted fields; unknown fields are rejected rather than silently
persisted. Services hold business rules and use the injected Prisma service.

Candidate portal controllers run `CandidateSessionGuard` followed by
`CandidatePasswordChangedGuard`. The first validates the cookie and reloads the
active account; the second enforces the initial password change. Controllers take
the candidate ID from this trusted principal, never from a request body. Login,
identity, password change, and logout intentionally remain outside the second
guard so candidates can complete or leave the password-change flow.

Admin controllers use `AdminBasicAuthGuard`; a candidate cookie is not an admin
credential. The admin service response projections serialize bigint IDs and
expose authentication availability flags without returning credential material.

## Business rules that need context

- Candidate profile normalization discards unknown categories and `Other`, and
  removes preferences that also occur in exclusions.
- Pipeline records belong to a candidate/company pair. Removing a pipeline record
  does not delete the shared company or another candidate's record.
- Pipeline saves follow the legacy form semantics: blank notes clear, omitted
  reapply counts reset to zero, and an Applied state without a date defaults to
  today in UTC. Other states without a date preserve the existing application date.
- Company edits and category replacement share one transaction. Candidate profile
  changes and password initialization/reset also share one transaction. Settings
  writes update the ten editable keys atomically and leave other settings alone.
- Sessions are stateless signed tokens. Logout expires the browser cookie; it
  does not revoke a copied token. The session guard still reloads account activity
  and the password-change flag on each request.
- `/api/v1/health` reports process liveness, not database readiness.

## Recommendation request flow

`CandidateRecommendationsController` applies both candidate guards and delegates
only the trusted principal ID plus the validated limit to `MatchingModule`.
`CandidateRecommendationsService` projects the active profile, scans OPEN jobs in
200-row keyset batches, and retains at most 20 ranked rows. Related categories and
candidate state are loaded with each batch; no per-job query loop is used.
Bigint job IDs remain bigint internally and serialize as decimal strings.

The pure `matching/domain` code preserves the legacy deterministic policy and
has no Nest, Prisma, HTTP, or AI dependency. Exclusions run before weighted scoring;
the service applies the candidate's threshold afterward. Score ties use descending
job ID. Notifications do not suppress portal recommendations. This read does not
crawl, send email, consume Quick Search quotas, or invoke AI.

Memory is bounded by a batch plus the result limit, but computation remains linear
in eligible jobs. Concurrent updates can be visible between batches; the API does
not promise a frozen snapshot. Before large-scale traffic, profile this path and
consider invalidated, precomputed rankings rather than caching personalized data
without accounting for profile and blacklist changes. Deadline and numeric-years
support from `gpt1.md` still require schema and ingestion work.

## Quick Search quota and company selection

`QuickSearchModule` imports the exported `SettingsService` rather than registering
another provider. Its usage endpoint is read-only. The internal `reserve` method
uses a transaction-scoped advisory lock keyed by candidate bigint ID, compatible
with the legacy process, then checks quotas and inserts an unfinished run. Never
hold this transaction open during crawling or AI calls. Failed and unfinished
runs consume quota, preventing retries/restarts from granting extra searches.

The count query captures PostgreSQL statement time after acquiring the lock,
calculates Asia/Dhaka day bounds, and reuses that timestamp for insertion. This
avoids app-server clock drift and a count/insert midnight mismatch. Read Committed
ensures the count sees the preceding reservation after waiting on its lock.
Settings are read before reservation; changes apply to subsequent requests.

The selector uses parameterized SQL because ordering by a filtered category count
is not supported by the current Prisma query shape. Filtering, ranking, and LIMIT
run in PostgreSQL; no full catalog is materialized in Node. Blacklisted companies
are excluded, in addition to active/monitor-ready/career-URL checks.

The future orchestrator must validate Standard/AI availability before reservation,
finalize the returned bigint run ID after success/failure, and handle interrupted
work without automatically refunding quota. Reservation is not a job queue or
idempotency mechanism. No execution endpoint exists yet, and settings enabling
AI do not mean a migrated AI provider is available.

## Commenting conventions

Use a short JSDoc comment above each controller/service class to explain its
responsibility, and above important methods to explain the contract or rule.
Keep comments above Nest decorators. Add inline comments where an unusual default,
a transaction boundary, or a security constraint would otherwise be surprising.
Do not narrate obvious assignments or repeat types with prose. Update comments
when behavior changes; tests remain the evidence that the rules hold.

## Checking a change

From the repository root, run `pnpm check:style`, backend source/test typechecks,
and the relevant test suite. `pnpm --dir backend test` uses database mocks;
`pnpm --dir backend test:database` uses disposable PostgreSQL. Browser test setup
and scope are documented in `backend/test/README.md`.

## Prisma tooling

Edit model fragments under `backend/prisma/schema/`, then run
`pnpm --dir backend prisma:sync`. The exact Ferio V2 builder assembles them before
client generation. `prisma:generate` alone does not rebuild fragments. The
scripts-local ESM package leaves the Nest runtime module format unchanged.

Migration commands are wired but require baseline review for the existing
schema. Seed commands deliberately refuse writes. See `backend/prisma/_doc.md`
for the complete command table; there is no platform database in this project.

## Crawler ingestion boundary

`job-crawling/domain/career-page.parser.ts` accepts fetched HTML without performing
network requests. The 2 MiB limit protects parsing; the exported `CareerPageFetcherService` also enforces a streaming body limit,
timeout, and redirect/address checks before allocating the full response. HTTP(S) scheme checks alone are not SSRF
protection. Known source overrides are preserved as a pure resolver.

`CrawlIngestionService.ingest` parses first, then atomically persists at most 150
legacy-hash job upserts, the company check timestamp, and a success log. It requires
an active monitor-ready company. The first company update serializes persistence
for that company; it does not prevent duplicate network work or establish fetch
freshness ordering. Missing descriptions retain old content, and absent jobs are
not automatically closed. Transaction failures roll back all successful-page writes.

The orchestrator must call `recordFailure` with a sanitized diagnostic after
fetch, parsing, or persistence errors. This separate path updates the check time
and failure log without changing jobs. Rich log fields and persisted application
deadlines from gpt1 still require schema work. No execution endpoint is exposed.

## HTTP crawler transport

`CareerPageFetcherService.fetch` returns the `CareerPage` input consumed by
`CrawlIngestionService`. Keep these phases separate: never open a transaction
before fetching. The future orchestrator resolves source overrides, fetches,
ingests, and records sanitized failures. The transport itself never writes data.

Every URL uses HTTP(S), its default port, and no credentials. DNS responses must
contain only permitted public addresses; IPv6 additionally requires global
unicast space. The socket connects to one validated IP, while TLS certificate
verification and SNI use the original host. Every redirect repeats validation.
No environment proxy, cookies, or application authorization are forwarded.

The 20-second budget spans all hops. Bodies are streamed to a 2 MiB ceiling;
headers have a 16 KiB ceiling. The four-request capacity guard is per process,
not a distributed scheduler limit. DNS resolution uses the OS resolver and cannot
be cancelled; results arriving after the deadline are ignored. Only the first
validated address is tried; there are no network retries. HTML is decoded as UTF-8;
compressed responses and non-HTML content are rejected deliberately. These limits
may require explicit source adapters for otherwise legitimate sites.

Transport errors contain stable codes and fixed diagnostic messages without
remote URLs, response content, or raw network errors. Deployment egress controls
remain useful defense in depth; no live-network security verification is claimed.

## Daily command and source orchestration

Build the backend, then run `pnpm --dir backend crawl:daily --help` to inspect the
command without loading the worker context or opening database connections.
The command without `--help` performs real network requests and job/log writes.
It is designed for an external scheduler at 06:15 Asia/Dhaka; existing deployment
scripts still invoke the legacy runtime until cutover is reviewed.

`CrawlExecutionModule` provides the transport, ingestion, single-company
orchestrator, and daily runner. `DailyCrawlRepository` owns catalog reads and
run-lock connections. Companies are selected in batches of 50 using ascending IDs
and a fixed upper ID. Reads are live, not a frozen database snapshot. Per-company
failures continue only after their sanitized failure log is persisted; failures
in that persistence abort the command. `jobsFound` counts detected/upserted jobs,
not exclusively newly inserted jobs.

`CRAWL_DELAY_MS` defaults to 750 (integer 0–60000). Optional `CRAWL_LIMIT` bounds
checked companies (integer 1–100000). Blank career URLs are skipped and do not
consume that limit. SIGINT/SIGTERM stops scheduling the next company, finishes
current bounded fetch/persistence, closes providers, and returns a nonzero status.
An already-running replacement worker produces an `already-running` summary.

Run ownership uses `pg_try_advisory_lock(124631, 1)` on one dedicated PostgreSQL
connection, not a Prisma transaction or pooled session. This costs one additional
connection for the duration of the job. `CRAWLER_LOCK_DATABASE_URL` can supply a
direct connection to the **same database**; otherwise DATABASE_URL is used.
Transaction pooling is incompatible with session locks. Known Neon pooler URLs
are rejected; other proxy configurations must be checked by the operator.
The worker checks connection health at phase boundaries but does not implement
a fencing token for persistence already underway when a connection is lost.
Do not overlap the legacy daily script, which does not take this lock.

Standard Quick Search should reuse `CompanyCrawlService` after reserving quota,
and must finalize its own search-run record. Daily crawling does not reserve
candidate quotas or provide the pending AI/Quick Search UI.
