# Persistence reference

The former Drizzle/Redis examples targeted another application and are replaced
by the project-owned [database rules](../../../rules/backend-database.md) and
[transaction rules](../../../rules/backend-transactions.md).

Use focused repositories for complex/reused persistence or connection ownership.
Preserve current Prisma service patterns where appropriate; introduce caching only
with a concrete need and an identity/invalidation plan. No global cache fallback
or external-machine reference is part of this application's contract.
