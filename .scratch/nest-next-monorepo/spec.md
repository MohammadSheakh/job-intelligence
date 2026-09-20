# NestJS + Next.js monorepo migration

Status: claimed
Triage: task

## Goal

Create two applications inside this repository without changing product
behaviour defined in `PRD.md` or recorded in `IMPLEMENTATION_CHECKLIST.md`:

```text
backend/   NestJS + Prisma, following Ferio backend structure
frontend/  Next.js application for admin and candidate views
```

## Architectural decision

Job Intelligence is a single-tenant, single-database application. The Ferio
reference is applied for feature boundaries, Prisma, typed services,
configuration, security, test placement and verification. `platform/` and
`tenancy/` are intentionally excluded.

The target directory layout is:

```text
backend/libs/  common, database, notification, queue, redis when each has a real need
backend/prisma/ migrations, schema, scripts, seeds (no automatic seeding)
backend/src/   config, core, features, infrastructure, shared
frontend/      Next.js admin and candidate web UI
```

## Compatibility requirements

- Preserve the existing database schema and data; Prisma maps to it rather than
  replacing it.
- Preserve candidate-only access, admin-created accounts, the default-password
  first-login change, Google binding rules, matching rules, crawler rules,
  quick-search limits and notification de-duplication.
- Keep the legacy runtime available until API and UI parity are verified.
- Do not claim a migrated feature complete without API, UI, and verification
  evidence.

## Acceptance slices

1. `backend/` and `frontend/` foundations and operational documentation.
2. Prisma data-access foundation mapped to the existing SQL schema.
3. Nest feature modules and API contracts for authentication, admin,
   candidate portal, companies/jobs/categories/settings, crawler, matching,
   notifications and workers.
4. Next.js admin and candidate pages with equivalent flows.
5. Container/scripts cutover, parity testing, and removal of the legacy HTTP
   rendering layer only after verification.

## References

- `PRD.md`
- `IMPLEMENTATION_CHECKLIST.md`
- `docs/DATABASE_SWITCHING.md`
- `.agents/skills/ferio-backend-architecture-v2-current/SKILL.md`
