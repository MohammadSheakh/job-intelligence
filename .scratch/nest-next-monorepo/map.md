# Nest/Next monorepo migration map

## Notes

- Legacy request entry point: `src/admin/server.ts`; it sends `/portal/*` and
  Google routes to `src/portal/routes.ts`, while all other UI is admin HTML.
- Existing persistence is PostgreSQL through `src/db.ts` and SQL migrations in
  `sql/`. The migration must be data-preserving.
- Candidate and admin authentication have intentionally different trust models.

## Decisions-so-far

- 2026-09-20: use explicit `backend/` and `frontend/` applications; retain the
  legacy root runtime during staged feature migration.
- 2026-09-20: add `docs/ARCHITECTURE_MIGRATION_STATUS.md` as the primary
  cross-session handoff document. `.scratch/` remains the issue-level record.
- 2026-09-20: introduce `/api/v1` for the new Nest API. The existing browser
  routes stay stable until Next.js parity and cutover validation are complete.

## Fog

- Exact Prisma mapping requires a database schema introspection/SQL audit.
- UI implementation order must follow API contract parity.
