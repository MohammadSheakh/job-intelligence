# Backend regression tests

From the repository root:

```bash
pnpm --dir backend test
pnpm --dir backend test:database
pnpm --dir backend typecheck:test
```

The default suite runs 20 Jest/Nest TestingModule/Supertest tests with mocked
Prisma. It covers authentication primitives and HTTP flows, profile validation,
admin authorization, and company category replacement orchestration.

The separate database suite runs 45 HTTP tests (21 candidate and 24 admin) with the real Prisma service and
PostgreSQL 16. Docker must be running; the runner uses `postgres:16` (Docker pulls
it if absent). It creates a unique container with temporary storage, random test
credentials, and a dynamically assigned loopback port. It applies the repository's
`sql/001_init.sql` and `sql/008_runtime_schema.sql` to that empty database and
creates synthetic fixtures. It removes only its own container on completion,
failure, SIGINT, or SIGTERM. A forced process kill may require manual cleanup of
the uniquely named `job-intelligence-test-*` container.

The runner never loads `.env`, accepts no external database URL, and overrides
inherited database/session variables. It does not run the existing Compose stacks
or copy Neon data. The suite rejects direct execution without the disposable
runner's local database configuration.

Database tests cover profile persistence, two-account isolation, company browse,
category catalog, pipeline mutations, mandatory password-change enforcement,
password replacement, and invalid input. Admin tests cover all six implemented
API groups: candidate management, companies, categories, jobs, settings, and
crawler logs. Temporary check constraints force real database write failures and
verify rollback of candidate profile/password changes, company/category updates,
and settings transactions. These constraints are installed only after the suite
checks the disposable runner configuration and are removed in `finally` blocks.
Shared reference-category fixtures tolerate either suite execution order.

Both suites import real feature modules with the application's validation options
and API prefix, but not AppModule. They do not test browser behavior, the production
bootstrap/CORS configuration, concurrency under load, or exhaustive feature parity.

Tests are excluded from the production TypeScript build and checked separately
with `typecheck:test`. The database suite is deliberately excluded from `test`
so the fast suite needs no Docker or database.

## Browser verification

Install backend and frontend dependencies and the Chromium binary first:

```bash
pnpm --dir backend exec playwright install chromium
pnpm --dir backend test:browser
```

The browser command reuses the disposable PostgreSQL runner. Eight Jest/Playwright
checks run real Chromium against Nest feature modules and Next development mode:
unsigned direct navigation, mandatory password-change navigation, invalid login,
password replacement, profile persistence, company tracking/pipeline edits and
removal, and logout. Nest listens on loopback with credentialed CORS for the test
frontend. No cloud database, user account, or live credentials are used.

The fixture copies frontend source/configuration into a temporary directory and
links its installed dependencies. Next writes its generated configuration and
build output there, not in the developer's frontend directory. Browser contexts,
the Next subprocess, temporary source copy, Nest, and the disposable database are
closed/removed after the run. Tests require Docker, installed frontend dependencies,
and Playwright Chromium with its system libraries; on a fresh Linux machine use
`pnpm --dir backend exec playwright install --with-deps chromium` if needed.

These are desktop Chromium functional checks, not visual QA, cross-browser/mobile
coverage, production bootstrap verification, or full recommendation/Quick Search
parity. Browser checks are separate from the fast and database-only suites.
