# Architecture migration status

**Last updated:** 2026-09-21
**Status:** In progress — candidate core flows, Company Intelligence admin UI, and selected admin APIs are implemented with local regression coverage.
**Overall progress:** Tracked by the completed and remaining milestones below; no weighted completion percentage is defined.

## Final direction

The repository will contain independent applications:

```text
backend/   NestJS + Prisma API
frontend/  Next.js App Router UI
```

`backend/` follows the applicable Ferio layout: `libs/`, `prisma/`, and `src/`
with `config/`, `core/`, `features/`, and `infrastructure/`. This is a
**single-tenant** application: no tenancy or runtime platform/control-plane
code or Prisma platform placeholders belong in the replacement.

## Data safety

- Neon data is authoritative and already seeded. Do not seed, reset, truncate,
  or apply unreviewed migrations.
- Neon was introspected read-only. `backend/prisma/schema.prisma` now contains
  all 11 discovered models and Prisma Client was generated from that file.
- `backend/prisma/schema/` has the desired Ferio-style modular layout. Its
  fragments now rebuild the complete introspected schema, so
  `pnpm prisma:generate` is safe to use locally.
- Prisma cannot express three existing database check constraints (candidate
  score range, category type, and job status). Preserve them in Neon and
  duplicate their policy through DTO/service validation.

## Implemented (validation scope noted below)

- Created independent `backend/` and `frontend/` package boundaries.
- Created Ferio-style backend library roots: `common`, `database`,
  `notification`, `queue`, and `redis`; `common/src` has the requested
  organizational folders.
- Added Nest app bootstrap, typed configuration, CORS, global `/api/v1`
  prefix, validation, and Prisma 7 + `@prisma/adapter-pg` database service.
- Built the candidate authentication API: login, signed HTTP-only cookie
  session, `me`, mandatory password change, and logout. Legacy scrypt password
  compatibility is retained.
- Built candidate API endpoints for profile, category catalog, company browse,
  and application pipeline state. These use Prisma queries/services instead of
  raw SQL repositories.
- Built Next.js candidate login, candidate overview, mandatory password-change,
  profile-edit, company-browse, and application-pipeline routes. They call the
  Nest API with credentials included.
- Candidates can now create, change, or remove a company pipeline state from
  the company-browse page, as well as edit/remove it from the pipeline page.
- Added Tailwind CSS v4 and PostCSS to the isolated Next.js application. The
  candidate shell uses mobile-first layouts with responsive `sm` and `lg`
  breakpoints; no legacy behavior changed.
- Migrated Company Intelligence admin APIs under `/api/v1/admin`: bounded,
  filterable company listing; company detail/update; category listing/upsert.
  These use Prisma services, DTO validation, a transaction for category
  replacement, and the legacy Basic Admin credentials via a timing-safe guard.
- Corrected the backend production start script to `dist/src/main.js` and
  exported the candidate-session dependency required by the imported guard.
  Nest starts and registers the routes; an unauthenticated admin request was
  verified to return HTTP 401.
- Migrated the read-only admin Jobs catalog to `/api/v1/admin/jobs`, preserving
  legacy search/status filters, company/category projections, descending
  discovery ordering, and bounded pagination. It is protected by the same
  admin guard and has no database mutation path.
- Migrated persisted admin runtime settings to `/api/v1/admin/settings`.
  The API reads the same defaults and updates only the ten existing editable
  keys in a single Prisma transaction, with legacy bounds enforced by DTOs.
- Migrated admin candidate management to `/api/v1/admin/candidates`: list,
  detail, create, and update with duplicate-email protection, profile/category
  normalization, and legacy-compatible default-password/password-reset rules.
- Migrated read-only crawler monitoring to `/api/v1/admin/crawl-logs`, with
  legacy descending order, linked-company-only rows, and bounded pagination.
- Backend typecheck plus frontend typecheck and production build pass after the
  candidate portal routes above were added.
- Completed the modular Prisma schema fragments for every introspected model,
  then rebuilt, validated, and generated Prisma Client locally. No Neon schema
  or data mutation was performed.
- Installed and applied `nextjs-app-router-patterns`; Nest changes follow the
  local `nestjs-best-practices` guidance.

## Automated verification added

- Added Jest, Nest TestingModule, and Supertest with a separate test TypeScript
  configuration. `pnpm --dir backend test` runs 20 database-isolated tests;
  `pnpm --dir backend test:database` runs 45 real PostgreSQL API tests (21 candidate and 24 admin).
- Authentication tests cover legacy scrypt compatibility, password length,
  signed-session tampering/expiry, login, identity, password change, logout,
  inactive accounts, and malformed cookies.
- Candidate profile HTTP tests cover session scoping, normalization, exclusion
  precedence, read-only identity fields, and score bounds. Admin HTTP tests
  verify separate Basic credentials and pagination bounds.
- Company service tests cover transactional category replacement, the `Other`
  fallback, and rejection of missing companies/categories before writes.
- Regression tests reproduced and now cover two fixes: malformed cookie encoding
  returns HTTP 401 instead of 500, and session tokens with extra fields are rejected.
- The default suite replaces Prisma with mocks. The separate database runner
  creates a uniquely named PostgreSQL 16 container with temporary storage and a
  dynamically assigned loopback port, applies `sql/001_init.sql` and
  `sql/008_runtime_schema.sql`, creates synthetic candidate/company fixtures,
  and removes its own container on completion. Neither suite loads `.env`;
  the database runner does not accept an external database URL.
- Real database tests cover profile persistence, candidate isolation, company
  search/category filters, category catalog, pipeline create/update/filter/delete,
  password-change enforcement, and invalid requests.
- Fixed verified migration gaps: all candidate portal reads/writes require the
  initial password change (HTTP 403); `me`, change-password, and logout remain
  accessible. Pipeline edits clear empty notes and refresh `updated_at`, default
  Applied dates to the current UTC date, and reset omitted reapply counts to zero
  as in the legacy form flow. Company browse limits must be integers.
- Admin database tests cover Basic authorization for all six API groups,
  candidate create/edit/reset and duplicate-email rejection, safe response
  serialization, company/category edits, job filters/pagination, crawler-log
  ordering, settings persistence, and input validation.
- Database constraint failures injected only into the disposable test database
  verify rollback of company edits/category replacements, all settings writes,
  and candidate profile/password writes. Candidate management now persists
  profile and authentication changes in one Prisma transaction, preventing
  partial saves when password storage fails.
- Candidate IDs must be positive decimal PostgreSQL bigint values; malformed
  or overflowing IDs return HTTP 400 rather than reaching Prisma.
- All 65 tests, backend source/test typechecks, and the Nest build passed.
  This does not establish exhaustive feature parity, browser behavior, Neon
  runtime behavior, or production readiness.

## Code review tooling

- Root Prettier, ESLint, and EditorConfig cover the legacy application, backend,
  frontend, tests, and maintained scripts/configuration. Source has been expanded
  into consistent multiline formatting, including Nest DTO decorators.
- Root `pnpm check:style` enforces formatting and lint with zero warnings; backend
  and frontend packages expose scoped commands using the root tool installation.
- VS Code recommendations/settings and the Code style CI workflow keep new
  changes consistent. Formatting excludes generated output, data/SQL assets,
  bundled skills, and embedded template contents.
- Verified formatting and lint with zero warnings, all 65 backend tests,
  backend source/test typechecks and build, and frontend typecheck/build.
  The previously documented legacy root typecheck errors remain; this cleanup
  does not change those legacy runtime/type compatibility issues.

## Backend documentation and browser verification

- Backend controllers/services, authentication guards, DTOs, configuration
  helpers, and database lifecycle methods now explain their responsibilities and
  important rules in JSDoc. Inline notes clarify transaction and pipeline-date
  behavior. `docs/BACKEND_DEVELOPER_GUIDE.md` explains request flow and commenting
  conventions for future contributors.
- Added eight real Chromium checks via `pnpm --dir backend test:browser`, using
  disposable local PostgreSQL, synthetic accounts, Nest feature modules, and a
  temporary copy of the Next frontend in development mode.
- Browser tests reproduced five navigation failures. Structured API errors now
  direct unsigned candidates to login and accounts requiring a password change
  to the change-password page, including direct profile/company/pipeline URLs.
- Verified login failure, password change, profile persistence, company tracking,
  pipeline update/removal, and cookie-clearing logout. Added Sign out to the
  candidate overview so the browser flow includes ending a session.
- All 73 checks (20 isolated, 45 PostgreSQL, eight browser), style/lint checks,
  backend source/test typechecks and build, and frontend typecheck/build pass.
  Visual/mobile/cross-browser QA and production bootstrap checks remain separate.

## Company Intelligence admin UI

- Added `/admin/companies`, company detail/edit, and `/admin/categories` to the
  Next frontend. Listing supports search, category/action filters, and pagination;
  editing persists research/contact fields, active state, and category assignments.
  Category management creates categories or updates their type by name.
- The admin layout uses the existing Basic-auth API. Credentials stay in React
  memory only; refresh, sign-out, or an API 401 requires signing in again.
  Candidate cookies do not grant admin access.
- Added eight Chromium checks for authorization, pagination/filtering, empty and
  failed requests, missing records, company/category persistence, credential
  rejection, and company-list overflow at a 390-pixel viewport. Desktop and mobile
  company-list screenshots were reviewed; broader visual and browser QA remains.
- Validation: 81 checks (20 isolated, 45 PostgreSQL, 16 browser), style/lint,
  backend source/test typechecks and build, and frontend typecheck/build.

## Deterministic recommendations migration

- Added a framework-independent matching domain preserving legacy scoring,
  normalization, category bonuses, and hard exclusions. The matching feature
  exports a Prisma-backed recommendation service to the candidate portal.
- `GET /api/v1/candidate/recommendations?limit=8` accepts 1–20 results, requires
  the signed session and completed password change, and returns decimal-string
  job IDs, scores, explanations, company links, and candidate tracking status.
- OPEN jobs are scanned by descending ID in batches of 200. Blacklists are
  filtered in the database; only the best requested results remain in memory.
  Ranking still takes work proportional to eligible jobs; this is not a
  precomputed recommendation index or a point-in-time database snapshot.
- The candidate overview now displays recommendations and Apply/Plan/Applied/
  Blacklist actions. Company links and application links allow HTTP(S) only and
  open separately with `noopener noreferrer`. Companies remains a research
  directory independent of matching.
- Scoring and OPEN-job eligibility preserve legacy behavior. Deadline filtering
  and numeric experience matching cannot be claimed until those fields and
  their ingestion paths exist; see the product follow-ups below.
- Validation for this milestone is limited to formatting/lint, source typechecks,
  builds, and code review. No tests were added or run, per the user's instruction;
  earlier 81-test results describe the preceding commit, not this change.

## Product follow-ups from gpt1.md

`docs/gpt-conversation/gpt1.md` supplies these pending requirements. They do not
imply completed migration parity:

- Admin Companies: manual-review queue and completion/recalculation; Add Company;
  controlled official-site/LinkedIn enrichment; external links in the table.
- Admin Jobs: persist/display application deadlines, reject explicitly expired
  jobs, define historical-listing rules without using age alone, and link company
  names to official sites.
- Admin Candidates: controlled experience levels plus numeric years; separate
  list, creation, and detail/edit routes.
- Crawler Logs: richer diagnostics and expandable/detail views. This request is
  for crawler logs, not candidate detail.
- Candidate Companies: paginated active-company research directory (25/page),
  location and personal-state filters; independent of recommendation eligibility.

## In progress / next verification work

1. Migrate crawler execution and persisted Quick Search orchestration, then
   connect the candidate Quick Search view. Deterministic recommendations are
   implemented; runtime verification is deferred.
2. Continue feature parity work below; Quick Search and Google OAuth
   remain outside the migrated core API scope.
3. Broaden candidate QA to visual/mobile/cross-browser behavior and production
   deployment configuration; the core desktop Chromium flow is now covered.

## Remaining work (ordered)

1. Complete candidate portal parity: Quick Search, the gpt1 company-directory
   requirements, and runtime validation of recommendations.
2. Extend admin browser coverage as the remaining views are implemented;
   company/category management and Basic authorization have initial coverage.
3. Port crawler execution, optional AI matching, Quick Search, notifications, email,
   Google OAuth, and operational scripts without changing product rules.
   Jobs catalog, crawler-log reads, persisted settings, and admin candidate
   management APIs have local database regression coverage; exhaustive parity
   and browser validation remain.
4. Build the remaining Next.js admin views against those APIs.
5. Add feature/unit/integration parity tests, then move Docker, scheduler,
   launch scripts, and CI to the two-app architecture.
6. Audit and remove only temporary root-level migration artifacts. Preserve the
   legacy app until documented parity, cutover, and rollback checks are done.

## Current working condition / agent handoff

- Legacy root `src/`, `scripts/`, and `sql/` remain the behavioral source of
  truth; the running legacy app has not been deleted or overwritten.
- The candidate portal backend is under
  `backend/src/features/{authentication,candidate-portal}/`.
- The candidate frontend is under `frontend/app/candidate/`; Company Intelligence
  admin pages are under `frontend/app/admin/`.
- API base URL defaults to `http://localhost:4000/api/v1`; configure
  `NEXT_PUBLIC_API_URL` for another environment. Backend CORS accepts
  `FRONTEND_ORIGIN` (default `http://localhost:3000`).
- Existing IDE tabs for `repositories/candidate-profile.repository.ts` are
  stale: repositories were intentionally removed because the service now uses
  Prisma directly; controllers delegate only to services.
- The legacy root `pnpm typecheck` currently fails in existing legacy sources
  (`src/admin/server.ts`, `src/auth/password.ts`, and `src/crawler/generic.ts`)
  due to dependency/type compatibility errors. The root package and TypeScript
  configuration were restored to their committed legacy form; this failure is
  not caused by the Nest/Next package boundaries.
- Before backend edits, read
  `.agents/skills/nestjs-best-practices/SKILL.md`; before frontend edits, read
  `/home/chillpc/.agents/skills/nextjs-app-router-patterns/SKILL.md`.

## Verification commands

```bash
# Run from the repository root (job-intelligence-prd-db-switch/).
pnpm --dir backend test
pnpm --dir backend test:database # requires Docker and postgres:16
pnpm --dir backend test:browser # also requires Playwright Chromium and frontend dependencies
pnpm --dir backend typecheck
pnpm --dir backend typecheck:test
pnpm --dir backend build
pnpm --dir frontend typecheck
pnpm --dir frontend build
git diff --check
```

Do not run `prisma migrate`, `prisma db push`, `prisma db seed`, or
`prisma migrate reset` against Neon during this migration.
