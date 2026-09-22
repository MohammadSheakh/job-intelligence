# Implementation checklist

This document records feature-level acceptance evidence. Earlier product sections
track the legacy application; sections explicitly labeled replacement track the
NestJS/Next.js migration. A legacy `[x]` does not establish replacement completion.
The [migration handoff](docs/ARCHITECTURE_MIGRATION_STATUS.md) owns replacement
progress and next steps; do not derive another percentage from this mixed checklist.

Legend: **[x] Done**, **[~] Implemented but external/runtime validation remains**, **[ ] Pending / not in MVP**.

This checklist is intentionally conservative. A feature that exists in source code but still needs real external credentials or broad production validation is marked `[~]`, not `[x]`.

## Product foundation

- [x] One Node.js application serves separate Admin and Candidate views.
- [x] PostgreSQL persistence layer.
- [x] Neon-compatible PostgreSQL connection through `DATABASE_URL`.
- [x] Local Docker PostgreSQL mode.
- [x] Explicit Local <-> Neon switching scripts and documentation.
- [x] Active database mode shown in Admin and `/health`.
- [x] Ferio shared design system in `src/ui/ferio.ts`.
- [x] Responsive/mobile-safe Admin and Candidate layouts.
- [x] Live secrets excluded from packaged source by policy/configuration.

## Dataset and companies

- [x] Curated company dataset imported into normalized `companies` table.
- [x] Duplicate research rows consolidated into company entities.
- [x] Source research notes/URLs preserved.
- [x] Company status/recommended action supported.
- [x] NHPF normalized as `No Hiring Page Found`, not a category.
- [x] NHPF excluded from normal monitor-ready crawling.
- [x] Multi-category company model (`categories`, `company_categories`).
- [x] Technology/domain/sector/other category types.
- [x] Admin can filter/edit company categories.
- [x] Deterministic category enrichment command.
- [~] Broad web/AI enrichment of all `Other` companies is incomplete by design; ambiguous companies remain `Other`.

## Crawler and jobs

- [x] Fetch + Cheerio generic crawler.
- [x] Source override mechanism.
- [x] Daily crawler script.
- [x] Crawl logs table/repository/admin page.
- [x] Stable job hashes and idempotent upsert.
- [x] Explicit no-opening handling.
- [x] Deadline/expired listing handling in generic extraction.
- [x] Daily schedule defaults to approximately 06:15 Asia/Dhaka.
- [x] Docker scheduler included.
- [x] GitHub Actions daily workflow included.
- [~] Full live validation across all monitor-ready company sites is not complete; per-site exceptions will continue to appear.
- [~] Anti-bot/JS-heavy sites may need adapters or remain disabled; bypassing protections is out of scope.
- [x] Jobs are not auto-closed after one missing crawl.
- [x] Verified seed SQL cleaned to avoid the earlier unverified Genex bulk set.

## Categories and matching

- [x] Deterministic matching works with AI off.
- [x] Expertise/job-family scoring.
- [x] Skill scoring and aliases.
- [x] Location preference scoring.
- [x] Excluded location hard rejection.
- [x] Experience scoring.
- [x] Work-mode handling.
- [x] Preferred/excluded candidate categories.
- [x] Sector exclusion hard filter.
- [x] Technology/domain exclusion applies only when the job matches it.
- [x] Company-category contextual bonus is capped.
- [x] `Other` category does not create a positive match signal.
- [x] Category phrase/word-boundary matching avoids short-label false positives such as `AI` inside unrelated words.

## AI

- [x] AI can be globally enabled/disabled through settings.
- [x] AI matching can be independently enabled/disabled.
- [x] AI daily call limit setting.
- [x] OpenAI-compatible provider interface.
- [x] AI errors fall back to deterministic matching.
- [x] Hard exclusions cannot be overridden by AI.
- [~] End-to-end AI provider call needs an actual configured provider/key/model.

## Candidate accounts and profile

- [x] Admin can create/update candidates.
- [x] Default candidate password configurable; current product default is `asdfasdf`.
- [x] Default password is hashed with `scrypt`, not stored plaintext.
- [x] Candidate must change the default password after first login.
- [x] Candidate email/password login.
- [x] Signed expiring candidate session cookie.
- [x] Candidate password-change screen.
- [x] Candidate self-service profile editing.
- [x] Candidate email remains read-only in self-service profile.
- [x] Skills, expertise, experience, locations, work modes, category preferences, exclusions, threshold supported.
- [~] Google OAuth flow implemented; requires real Google client credentials and redirect configuration to validate end-to-end.
- [x] No open public candidate registration.

## Candidate recommendations and pipeline

- [x] Candidate dashboard shows current ranked recommendations.
- [x] Recommendation explanations/context.
- [x] Apply link action.
- [x] Planning state.
- [x] Applied state.
- [x] Blacklist state (`EXCLUDED` internally).
- [x] Latest application date.
- [x] Re-apply count.
- [x] Candidate notes per company.
- [x] Blacklisted companies suppressed from recommendations.
- [x] Pipeline filters/list.

## Quick Job Search

- [x] Candidate Standard Quick Search.
- [x] Candidate AI-assisted Quick Search option.
- [x] Persistent per-candidate usage records.
- [x] Default limit: 3 quick searches/day.
- [x] Default limit: 1 AI quick search/day.
- [x] Default maximum: 8 relevant companies per quick search.
- [x] Admin can change Quick Search limits.
- [x] Candidate dashboard shows remaining usage.
- [x] Quick Search prefers relevant companies rather than crawling every monitor-ready company.
- [x] Quick Search results have Apply/Plan/Applied/Blacklist actions.

## Email/notifications

- [x] SMTP transport implementation.
- [x] Candidate digest renderer.
- [x] Daily notification command.
- [x] Notification deduplication table/logic.
- [x] Email can be disabled without breaking the application.
- [~] Real SMTP delivery requires provider credentials and an end-to-end delivery test.

## Admin operations

- [x] Dashboard.
- [x] Companies list/detail/edit.
- [x] Category management.
- [x] Jobs view.
- [x] Candidate management.
- [x] Crawler logs/status view.
- [x] Settings view.
- [x] Quick Search limit controls.
- [x] AI controls.
- [x] Email enable/disable setting.
- [x] Separate Admin authentication from Candidate authentication.
- [~] Admin currently uses HTTP Basic Auth. Suitable for localhost/private MVP; public deployment should sit behind HTTPS and may later move to a stronger admin auth flow.

## Ferio design compliance

- [x] Grayscale-first palette.
- [x] Semantic color reserved for statuses/actions.
- [x] Black primary pill buttons.
- [x] Hairline dividers instead of decorative card shadows.
- [x] No gradients/glassmorphism/decorative shadows.
- [x] Neutral grotesk/system font stack.
- [x] Restrained radii/spacing.
- [x] Operational tables avoid zebra striping.
- [x] Direct UI copy.
- [x] Mobile layout rules present.
- [~] Browser-by-browser visual QA on physical/mobile devices remains a deployment QA task.

## Docker and database portability

- [x] Dockerfile.
- [x] Local Compose stack: app + PostgreSQL + scheduler.
- [x] Neon Compose stack: app + scheduler using external Neon.
- [x] Named volume preserves local PostgreSQL data.
- [x] Idempotent startup bootstrap.
- [x] Empty local DB gets company/category seed data.
- [x] Start/stop scripts for Windows and macOS/Linux.
- [x] `switch-db` scripts for Local/Neon.
- [x] `npm run db:status` reports current target/counts without printing credentials.
- [x] `/health` checks DB connection and reports configured database mode.
- [x] Local and Neon Compose stacks share the same project name to prevent accidental parallel app stacks.
- [x] Documentation states switching does not synchronize data.
- [x] Docker configuration verified by building both backend and frontend images in Docker runtime.
- [ ] Automatic Local <-> Neon data synchronization is intentionally out of MVP scope.

## Security and secrets

- [x] `.env` gitignored.
- [x] `.env` dockerignored from image build context.
- [x] No live Neon credential intentionally included in distributable project.
- [x] Candidate passwords hashed.
- [x] Signed expiring sessions.
- [x] Google account binding limited to existing active candidate email.
- [x] SQL writes use parameters in candidate/auth/application paths reviewed for this MVP.
- [~] Production HTTPS/reverse-proxy configuration is deployment-specific and not bundled as a managed hosting solution.
- [~] The previously exposed Neon password should be rotated by the database owner before public deployment.

## Verification and production readiness

- [x] SQL migrations/bootstrap designed to be idempotent where required for container startup.
- [x] Health endpoint.
- [x] Environment validation command.
- [x] Database-status command.
- [~] Full `npm install && npm run typecheck`/runtime test depends on a network-enabled environment with dependencies installed.
- [~] Full browser end-to-end test remains to be run after Docker starts on the target machine.
- [~] Real daily crawler run should be observed on the deployed network before calling crawler coverage production-stable.
- [~] Real SMTP test needed if email is enabled.
- [~] Real Google OAuth test needed if Google login is enabled.
- [~] Real AI provider test needed if AI mode is enabled.
- [ ] Public hosting/domain/TLS deployment is not performed by this repository itself.

## PRD governance

- [x] `PRD.md` is the source of truth for product requirements.
- [x] `IMPLEMENTATION_CHECKLIST.md` records implementation status without hiding partial/unverified work.
- [x] `docs/DATABASE_SWITCHING.md` is the source of truth for database-mode operations.
- [x] `npm run prd:audit` provides a structural guard against PRD/code drift.
- [x] README links to PRD, checklist, and database switching guide.
- [x] New feature work should update both PRD and checklist when behavior or scope changes.

## Replacement architecture verification

These items apply to `backend/` and `frontend/`; earlier feature completion
entries describe the legacy runtime.

- [x] Backend Jest runner with Nest TestingModule and Supertest, isolated from real databases and `.env`.
- [x] Initial authentication, candidate-profile HTTP, admin authorization, and company-category service regression coverage (20 tests).
- [x] Malformed candidate cookie encoding returns HTTP 401; signed sessions reject extra token fields.
- [x] Pipeline, company browse, and category catalog API coverage against disposable PostgreSQL 16 (21 candidate database tests).
- [x] Candidate profile/pipeline persistence and isolation verified using two synthetic local accounts.
- [x] Candidate portal reads/writes reject accounts requiring an initial password change; identity, password change, and logout remain accessible.
- [x] Pipeline note clearing, update timestamps, default Applied dates, and omitted reapply counts match the tested legacy behavior; browse limits require integers.
- [x] Initial database coverage for all six implemented admin API groups (24 admin database tests; 65 tests total).
- [x] Real constraint failures verify company/category, settings, and candidate profile/password transaction rollback.
- [x] Admin candidate creation and password resets persist atomically; invalid/overflowing candidate IDs return HTTP 400.
- [x] Eight desktop Chromium checks cover login failures, mandatory-password direct navigation, profile/pipeline mutations, and logout (73 checks total).
- [x] Company Intelligence Next admin UI: Basic sign-in, company filters/pagination/editing, and category create/type update.
- [x] Eight admin Chromium checks cover auth isolation, credential lifecycle, persistence, errors/retry, and narrow company-list overflow (81 checks total).
- [~] Desktop/mobile company-list screenshots reviewed; broader visual/mobile, cross-browser, and production bootstrap verification remains.
- [ ] Complete feature parity, operational cutover, and rollback validation before replacing the legacy runtime.

## Source readability and style checks

- [x] Shared Prettier, ESLint, and EditorConfig for legacy code, backend, frontend, and maintained scripts/configuration.
- [x] Multiline Nest decorators/declarations and readable DTO/controller/service formatting.
- [x] Root and package-level formatting/lint commands; lint runs with zero warnings.
- [x] VS Code format/fix-on-save settings and recommended extensions.
- [x] Code style CI workflow checks formatting and lint on pushes and pull requests.
- [x] Formatting cleanup verified with all 65 backend tests, backend source/test typechecks and build, and frontend typecheck/build.
- [~] Legacy root typecheck retains the previously documented compatibility errors; formatting/lint checks pass independently.

## Backend handoff documentation

- [x] Controller/service responsibilities and important method contracts documented in JSDoc.
- [x] Guard ordering, transaction boundaries, pipeline defaults, and session limitations explained for maintainers.
- [x] `docs/BACKEND_DEVELOPER_GUIDE.md` documents request flow and commenting conventions.

## Deterministic recommendations and Figma follow-ups

- [~] Pure deterministic matcher and guarded candidate recommendations API migrated; bounded job batches and result retention, bigint-safe IDs, legacy exclusions/thresholds.
- [~] Candidate overview recommendations with explanations, safe external links, and company pipeline actions implemented. Runtime/browser validation deferred; no tests added or run for this milestone at user request.
- [x] Quick Search crawler orchestration, persisted quota enforcement, and optional AI enhancement migrated to Nest/Next (milestone 15).
- [x] Admin company manual-review completion, creation, controlled enrichment, and table external links from gpt1.md.
- [x] Application-deadline persistence/display and evidence-based job freshness rules.
- [x] Controlled experience levels/numeric years and separate admin candidate list/new/detail views.
- [ ] Expanded crawler diagnostics/detail view (the gpt1 request concerns crawler logs).
- [ ] Candidate active-company directory pagination and location/personal-state filters, independent of matching.

## Replacement Quick Search execution

- [x] Guarded, read-only daily-usage API and candidate overview allowance display implemented.
- [x] Persistent quota reservation uses a shared PostgreSQL advisory lock, Dhaka day bounds, and atomic count/insert; runtime concurrency validation deferred.
- [x] Bounded PostgreSQL company selector preserves relevance/check-time order and excludes candidate blacklists.
- [x] Standard Quick Search execution orchestrator, sequential crawl checks, run finalization, and candidate execution UI wired.
- [x] Optional AI match enhancer service, bounded API timeouts, deterministic blending, and AI Quick Search execution UI wired (milestone 15).
- [x] Static formatting/lint, backend typecheck/build, frontend typecheck/build, and 26 unit tests verified.

## Email digests, notifications, and delivery deduplication

- [x] Pure email render service with HTML escaping, URL sanitization, and Ferio-style digest layout implemented (milestone 16).
- [x] Configurable SMTP transport service with Nodemailer and credentials validation.
- [x] Database deduplication service prevents duplicate emails to the same candidate via PostgreSQL `notifications` table.
- [x] Daily notification orchestrator evaluates deterministic fit, filters blacklists/notified pairs, transmits via SMTP, and records deliveries on success.
- [x] CLI command `pnpm notify:daily` with `--help` and signal handling wired for external schedulers.
- [x] Static formatting/lint, backend & frontend typechecks, production builds, and 36 unit tests verified.

## Prisma tooling alignment

- [x] Exact Ferio V2 builder, recursive schema assembly, and explicit script ESM boundary.
- [x] Backend schema build/generate/sync and migrate dev/status/deploy scripts added; ts-node and tsconfig-paths available for the seed entry point.
- [x] Local sync, schema validation, seed refusal, migration CLI help, style/lint, backend typecheck/build verified without database mutation.
- [ ] Existing Neon baseline adoption and live migration execution; seed writes remain explicit and are not part of adoption.


## Replacement crawler foundation and progress accounting

- [~] Legacy HTML extraction and job normalization/hash policy ported to a network-free domain parser with bounded input/output.
- [~] Transactional job upserts, company check timestamp, and success log; separate failure-log persistence implemented.
- [ ] HTTP transport, scheduling, Quick Search execution/finalization, and richer gpt1 deadline/log fields remain pending.
- [x] Explicit migration scorecard added: 12/24 equally weighted implementation milestones = 50%; no runtime-readiness percentage claimed.
- [~] Parser/ingestion runtime parity remains unverified; test development and execution deferred at user request.


## Replacement crawler HTTP transport

- [~] Public-address validation, pinned DNS, TLS hostname verification, and manually validated redirects implemented.
- [~] Shared deadline, bounded headers/body, per-process concurrency cap, and sanitized failure codes implemented.
- [ ] Daily/source orchestration and Standard Quick Search execution remain pending; milestone 13 is partial and overall progress stays 50%.
- [~] Static style/type/build validation only; tests and live-network checks deferred at user request.


## Replacement daily execution

- [~] Shared source-override/fetch/ingest/failure orchestration implemented.
- [~] Compiled daily CLI with bounded company batches, pacing/limit controls, graceful stop, and aggregate outcomes.
- [~] Dedicated direct-connection advisory lock coordinates replacement daily runners; runtime lock-loss/concurrency validation deferred.
- [x] Static formatting/lint, backend typecheck/build, and no-connection CLI help verified.
- [ ] Deployed scheduler cutover, live source coverage, and runtime parity remain pending; no tests or database operations run for this milestone.
- [x] Scorecard advanced to 14/24 implementation milestones (58.33%); 10 milestones (41.67%) remain.

## Replacement directory and crawler diagnostics (milestone 22)

- [~] Candidate directory API/UI pagination, category/location/status filters, stable ordering, and legacy array compatibility implemented.
- [~] Crawl HTTP/timing/engine/count diagnostics connected through orchestration and ingestion to expandable admin details.
- [x] Suggested actions preserve company workflow state; historical metrics remain nullable and refreshed counts are labeled accurately.
- [x] Applied `sql/009_crawl_log_diagnostics.sql` schema extension to both Neon and disposable test suites.
- [x] Runtime disposable database tests (45 tests) and Playwright browser tests (16 tests) executed and passing.

## Prepared Prisma seed and initial migration

- [x] Source-preserving seed preview and explicit insert-only apply workflow.
- [x] Fresh PostgreSQL initial migration with legacy CHECK constraints and checksum guard.
- [x] Disposable-database deploy/seed/rerun and preservation verification.
- [x] Existing Neon schema reconciliation, baseline adoption, and operational cutover.

## Database baseline, Docker, scheduler, scripts, and CI cutover (milestone 23)

- [x] Authoritative Neon database schema reconciled and baseline adopted (`0_initial` resolved as applied).
- [x] Schema extensions (`jobs.application_deadline`, `candidates.experience_years`, `crawl_logs` diagnostics) verified on Neon.
- [x] Direct seed workflow verified (`pnpm prisma:seed --apply`) with 0 duplicates and preserved operator data.
- [x] Automated migration generator `prisma/scripts/migrate-dev.mjs` wired into `prisma:migrate:dev` with checksum sync.
- [x] `backend/Dockerfile` and `frontend/Dockerfile` verified with pnpm 9 pinned and standalone Next.js build.
- [x] In-container `backend/docker-entrypoint.sh` runs migration checks and safe seed bootstrap.
- [x] `backend/scripts/docker-scheduler.mjs` implemented for cron/time-based crawl and digest execution.
- [x] Local `compose.yaml` and Neon `compose.neon.yaml` cut over to NestJS backend, Next.js frontend, and scheduler service.
- [x] GitHub Actions `.github/workflows/daily-crawl.yml` cut over to pnpm 9 and Nest CLI commands.
- [x] Disposable database (45 tests) and Playwright browser (16 tests) test suites executed and passing.

## Industrial-grade hardening, Redis rate limiting, session revocation, and production cutover (milestone 24)

- [x] Global `BigIntSerializerInterceptor` and `(BigInt.prototype).toJSON` polyfill eliminate unhandled BigInt serialization crashes across all API routes.
- [x] Global `GlobalHttpExceptionFilter` standardizes error responses to `{ code, message, timestamp, path }` and sanitizes unhandled 500 database/server errors.
- [x] Dynamic PostgreSQL connection pool (`DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONN_TIMEOUT_MS`) and idle client connection error handling.
- [x] Application graceful shutdown hooks (`app.enableShutdownHooks()`) for clean pool draining and socket teardown.
- [x] Database-backed candidate session revocation and versioning (`token_version` column on Neon, `POST /api/v1/candidate-auth/revoke`, and `?revoke=true` on logout).
- [x] Redis sliding-window rate limiting (`ferio-nest-prisma` architecture) using Redis Sorted Sets atomic pipelines, standard `X-RateLimit-*` headers, and computed `Retry-After`.
- [x] Route-level `@RateLimit()` presets protecting login, password change, revocation, Google OAuth, quick search, and admin operations.
- [x] Redis lifecycle hook (`RedisClientsLifecycle` with `OnModuleDestroy`) ensuring clean client disconnection on application teardown.
- [x] Crawler streaming decompression (`node:zlib` `createUnzip()` and `createBrotliDecompress()`) supporting gzip, deflate, and brotli with strict 2 MiB boundary safety.
- [x] Job matching scan bounded to `MAX_MATCH_SCAN_JOBS = 1000` to prevent event-loop and pool starvation under high vacancy volume.
- [x] Production-grade dual-portal root landing page (`frontend/app/page.tsx`) with system telemetry badges and direct gateway navigation.
- [x] Out-of-the-box `redis:7-alpine` container configuration with volume persistence and healthchecks in both `compose.neon.yaml` and `compose.yaml`.
- [x] All 5 automated testing layers passing: 125 unit/integration, 46 database integration, 11 e2e, 16 browser (198/198 passing, 100% pass rate).

