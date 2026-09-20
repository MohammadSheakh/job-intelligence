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

The separate database suite runs 21 HTTP tests with the real Prisma service and
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
password replacement, and invalid input. Both suites import real feature modules
with the application's validation options and API prefix, but not AppModule.
They do not test browser behavior, the production bootstrap/CORS configuration,
company transaction rollback, or all migrated admin APIs.

Tests are excluded from the production TypeScript build and checked separately
with `typecheck:test`. The database suite is deliberately excluded from `test`
so the fast suite needs no Docker or database.
