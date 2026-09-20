# Backend regression tests

From the repository root:

```bash
pnpm --dir backend test
pnpm --dir backend typecheck:test
```

Tests use Jest, Nest TestingModule, and Supertest. The HTTP fixture imports the
real authentication, candidate portal, and Company Intelligence modules with the
same validation options and API prefix as the application. Global test providers
replace Prisma and admin configuration; tests never import AppModule, load `.env`,
or instantiate a database client. Session secrets and credentials are test-only.

The suite covers authentication primitives and HTTP flows, candidate profile
validation/scoping, admin authorization, and company category replacement.
Company transaction mocks check orchestration and rejection before writes, not
PostgreSQL rollback behavior. Full local-database parity and browser tests remain
pending. Tests are excluded from the production TypeScript build and checked
separately with `typecheck:test`.
