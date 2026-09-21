# Backend API contracts

Applies to Nest routes and their consumers. Read [backend scope](../../backend/AGENTS.md).

- Keep `/api/v1`, existing routes, verbs, status codes, and response shapes stable
  unless an explicit coordinated contract change is part of the task.
- Validate input with the installed class-validator/class-transformer setup;
  reject unknown properties and bound strings, arrays, pagination, and numeric values.
- Candidate routes use session then password-change guards, except auth steps
  intentionally needed before the initial change. Derive candidate IDs from the
  trusted principal; scope every candidate-owned read/write to that ID.
- Admin Basic auth is independent of candidate cookies. Authorization in a UI
  is not backend access control. Shared services must enforce ownership invariants.
- Return explicit, serializable projections: bigint IDs as decimal strings,
  no password hashes/tokens/provider credentials, no raw Prisma entities by default.
- Preserve the existing top-level `message`/`code` error consumers. Map domain
  failures to suitable HTTP statuses and safe messages; do not introduce a nested
  error envelope or claim RFC problem-details compliance without a contract migration.
- Existing endpoints include arrays and `{ rows, total, page, pageSize }` catalogs.
  New paginated catalogs should use that catalog shape, integer bounds, deterministic
  ordering, and a stable tie-breaker. Use keysets for large sequential scans.
  Do not silently change array consumers or rename `pageSize` to `limit` globally.
- For a new 204 response, return no body and update clients to avoid JSON parsing.
  Existing void mutations need coordinated cleanup, not an isolated status change.
- Align DTO types, controller return types, and consumers. Add Swagger decorators
  only when OpenAPI tooling is actually installed and configured for the task.
- Protected responses use private/no-store caching where applicable. CORS must
  explicitly permit any new verb/origin; CORS is not authorization or a CSRF defense.
- Review CSRF implications of cookie mutations, duplicate submissions, conflict
  handling, and resource ownership. External callbacks require verified authenticity
  before side effects. Preserve legacy contracts while documenting unresolved gaps.
