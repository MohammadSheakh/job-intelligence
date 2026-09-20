# NestJS + Next.js backend/frontend migration

## Status

In progress. This is an architecture migration; current product behaviour stays
defined by `PRD.md` and `IMPLEMENTATION_CHECKLIST.md`.

## Target topology

```text
Browser
  ├─ frontend/ (Next.js, port 3000)
  └─ backend/ (NestJS, port 4000, /api/v1)
       └─ PostgreSQL (existing Local or Neon database)
```

The web app calls the API through `NEXT_PUBLIC_API_URL`; it never holds a
database connection or database credentials. API origins are allow-listed with
`WEB_ORIGIN`.

## Migration safety

- The legacy server remains the operational implementation during feature
  migration. Do not run a partial Next UI as the production replacement.
- The new API will map to the existing PostgreSQL tables. It must not reset,
  re-seed, or synchronize Local and Neon databases.
- Admin and candidate authorization are migrated separately because their
  existing security rules differ.
- The final cutover requires route-by-route parity tests, browser tests, a
  migration rehearsal using a copy of production-shaped data, and an explicit
  rollback plan.

## Progress

See `.scratch/nest-next-monorepo/` for the durable scope, decisions and
ticket-level status. Progress is reported in each implementation handoff.
