# Prisma map for existing PostgreSQL schema

Status: claimed
Type: task
Triage: platform
Blocked by: 01

## Scope

Create a complete Prisma schema and a Nest-owned Prisma connection for the
existing Job Intelligence tables. No schema migration, re-seed, or data rewrite
is permitted in this ticket.

## Acceptance

- Every table in `sql/001_init.sql` through `sql/008_runtime_schema.sql` maps
  to Prisma with its database name preserved.
- Relations, compound keys, unique constraints, and essential indexes match
  the current database contracts.
- The Nest database provider owns one bounded Prisma/pg connection lifecycle.
- `prisma generate`, static typecheck, and an introspection comparison against
  a configured safe database pass.

## Comments

- Claimed 2026-09-20 after the workspace foundation completed.
- 2026-09-20: a safe, generated client map now covers every current table; full
  field-by-field introspection remains open and is required before a feature is
  moved from its legacy repository.
- 2026-09-20: Prisma connected to Neon in read-only introspection mode. The
  local CLI print stream failed with `EBADF` before emitting the schema text;
  no database write occurred. Re-run with a non-piped terminal or a Neon branch
  before declaring field-level mapping complete.
