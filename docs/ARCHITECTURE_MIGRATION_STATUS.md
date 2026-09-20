# Architecture migration status

**Last updated:** 2026-09-20
**Status:** In progress — candidate core flows and selected admin APIs are implemented; initial automated regression coverage is in place.
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
  configuration. `pnpm --dir backend test` runs 20 focused regression tests.
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
- Tests replace Prisma with mocks and do not load `.env` or connect to a database.
  They do not establish SQL correctness, transaction rollback, full database
  parity, browser behavior, or production readiness.

## In progress / next verification work

1. Verify candidate portal API behavior end-to-end against a safe local account
   and isolated local database.
2. Extend coverage to pipeline operations, company browse, category catalog,
   admin candidate management, jobs, settings, and crawler monitoring.
3. Verify mandatory password-change enforcement and the complete candidate
   flow in a browser before claiming end-to-end parity.

## Remaining work (ordered)

1. Complete candidate portal UI and endpoint parity, including recommendations
   and Quick Search after the matching feature is migrated.
2. Build Company Intelligence admin UI and verify parity of the implemented
   company/category APIs and Basic authorization.
3. Port crawler execution, matching, Quick Search, notifications, email,
   Google OAuth, and operational scripts without changing product rules.
   Jobs catalog, crawler-log reads, persisted settings, and admin candidate
   management APIs are implemented; their broader parity validation remains.
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
- The candidate frontend is under `frontend/app/candidate/`.
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
pnpm --dir backend typecheck
pnpm --dir backend typecheck:test
pnpm --dir backend build
pnpm --dir frontend typecheck
pnpm --dir frontend build
git diff --check
```

Do not run `prisma migrate`, `prisma db push`, `prisma db seed`, or
`prisma migrate reset` against Neon during this migration.
