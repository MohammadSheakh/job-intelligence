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
