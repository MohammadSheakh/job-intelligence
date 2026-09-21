# Schema lifecycle review

Use the [database rules](../../../rules/backend-database.md) and
[Prisma instructions](../../../../backend/prisma/AGENTS.md) as authority.

For a proposed model, explain its identity, uniqueness, ownership, retention,
mutable fields, and relations. Choose physical deletion, deactivation, or soft
deletion from actual product/history requirements. Preserve existing cascades
and mapped database names. Add audit fields only with a real actor/retention
contract, not from a universal table template.

Review how timestamps and date-only values are produced, how uniqueness holds
under concurrent requests, and how existing data will migrate. This reference
does not authorize schema mutation or removal of legacy columns.
