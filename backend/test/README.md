# Backend Test Architecture & Organization

The backend test suite is organized into five explicit, complementary layers:

```text
backend/
├── src/**/*.spec.ts                  Layer 1: Co-located pure domain & unit tests (Fast, no DB/network)
├── test/integration/*.integration-spec.ts Layer 2: Nest component integration (Mocked Prisma & external APIs)
├── test/database/*.database-spec.ts  Layer 3: Real PostgreSQL integration (Constraints, transactions, advisory locks)
├── test/e2e/*.e2e-spec.ts            Layer 4: Full AppModule HTTP E2E tests (Supertest + real disposable PostgreSQL)
└── test/browser/*.browser-spec.ts    Layer 5: Real browser E2E (Playwright Chromium + Next.js + NestJS)
```

---

## Commands

From the repository root:

```bash
# 1. Fast tests (no Docker, no DB required, runs in ~5 seconds)
pnpm --dir backend test:unit         # Pure domain tests only (matcher, parser, template, crypto)
pnpm --dir backend test:integration  # Nest component integration tests only
pnpm --dir backend test              # Runs both unit and integration tests

# 2. Database & E2E tests (requires local Docker daemon running)
pnpm --dir backend test:database     # Disposable PostgreSQL constraints, transactions, and concurrency
pnpm --dir backend test:e2e          # Full AppModule + Supertest against disposable PostgreSQL

# 3. Browser E2E tests (requires Docker + Playwright Chromium)
pnpm --dir backend test:browser      # Real Chromium against running Next.js + NestJS app

# 4. Typecheck
pnpm --dir backend typecheck:test    # Validates all test files against tsconfig.test.json
```

---

## Layer Definitions & Guidelines

### Layer 1: Pure Domain Unit Tests (`src/**/*.spec.ts`)
- **Location**: Co-located right next to source files in `src/features/**/domain/` or `src/features/**/services/`.
- **Scope**: Pure logic with zero dependencies on Nest DI, Prisma, databases, or HTTP servers.
- **Examples**:
  - `matcher.spec.ts`: Scoring weights, exclusions, rank calculations, numeric year parsing, deterministic tie-breaking.
  - `career-page.parser.spec.ts`: DOM traversal, anchor/table/job extraction, deadline parsing, content hash generation.
  - `email-render.service.spec.ts`: HTML escaping, URL sanitization, score-based sorting.
  - `password.service.spec.ts`: Pure cryptographic scrypt hashing, salt generation, and verification.

### Layer 2: Component Integration Tests (`test/integration/*.integration-spec.ts`)
- **Location**: `test/integration/`.
- **Scope**: Multi-component NestJS feature modules instantiated with `@nestjs/testing` and mocked database/external providers.
- **Coverage**: Service use cases, guard boundaries, failure propagation, and transaction rollback calls with mock Prisma.

### Layer 3: Database Integration Tests (`test/database/*.database-spec.ts`)
- **Location**: `test/database/`.
- **Scope**: Executed against an ephemeral Docker PostgreSQL 16 container (`postgres:16-alpine`) on dynamic loopback ports.
- **Coverage**:
  - `quick-search-concurrency.database-spec.ts`: Proves that `pg_advisory_xact_lock` correctly serializes parallel requests and prevents race conditions or quota leaks under concurrent load.
  - `candidate-portal.database-spec.ts`: Multi-account isolation, profile/pipeline mutations, rollback with real CHECK constraints.
  - `admin-api.database-spec.ts`: All admin management APIs, transaction rollbacks, and catalog constraints.

### Layer 4: HTTP Application E2E Tests (`test/e2e/*.e2e-spec.ts`)
- **Location**: `test/e2e/`.
- **Scope**: Boots the full `AppModule` with Supertest against disposable PostgreSQL.
- **Coverage**:
  - `candidate.e2e-spec.ts`: Authentication, session cookies, `PASSWORD_CHANGE_REQUIRED` 403 guard, DTO rejection (`forbidNonWhitelisted`), identity tampering prevention (session-derived candidate identity), and BigInt serialization.
  - `admin.e2e-spec.ts`: Basic Auth verification, strict candidate/admin separation (candidate cookies rejected on admin endpoints), and admin DTO validation.

### Layer 5: Real Browser Verification (`test/browser/*.browser-spec.ts`)
- **Location**: `test/browser/`.
- **Scope**: Real Playwright Chromium browser driving Next.js 15 dev frontend connected to NestJS 11 backend and disposable PostgreSQL.
- **Coverage**: Candidate authentication, mandatory password redirects, profile persistence, tracking/pipeline edits, admin sign-in, filters, category creation, and responsive 390px mobile viewports.
