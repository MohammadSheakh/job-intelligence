# Database and persistence

Applies to Prisma/SQL work. Read [backend scope](../../backend/AGENTS.md) and
[Prisma scope](../../backend/prisma/AGENTS.md) when editing schema/tooling.

## Ownership

Use the configured single PostgreSQL database. See backend scope for when a
focused repository is warranted; existing direct-Prisma services remain valid
migration code. Do not mix a repository and scattered direct writes for a newly
introduced use case. No global repository base class or ORM replacement is required.

## Correctness

- Use Prisma parameters or tagged SQL. Validate dynamic sort/filter identifiers
  against explicit allowlists; values must never be concatenated into SQL.
- Keep bigint IDs intact until serialization. Validate input against database bounds.
- Preserve actual deletion semantics and cascades. A pipeline deletion removes
  a candidate/company link, not the company. Do not add soft-delete/audit columns
  to every model merely to satisfy a generic table taxonomy.
- Database constraints enforce uniqueness and invariants under concurrency;
  a check-then-insert alone is insufficient. Map known constraint conflicts safely.
- Prefer database time/defaults for new persisted audit/quota timestamps. Existing
  explicit timestamps and application-date semantics are migration contracts;
  change them deliberately with consumers and schema, not as incidental cleanup.
- Distinguish dates from instants: application dates are date-only, quotas use
  Asia/Dhaka day bounds, and transport deadlines are elapsed durations.

## Capacity

Project needed columns, bound result size, avoid per-row query loops for reads,
and choose indexes based on real predicates/order. Explain SQL where Prisma
cannot express the query. For long jobs use batches and stable cursors; avoid
loading all rows solely to slice later. State remaining scan complexity honestly.

Keep pools and connection ownership bounded. Session advisory locks require a
dedicated direct/session-preserving connection; transaction pooling is incompatible.
Caching is optional and requires a demonstrated need, identity-safe keys, expiry,
and invalidation design. Redis is not part of the current MVP architecture.
