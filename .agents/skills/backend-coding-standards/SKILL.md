---
name: backend-coding-standards
description: Review Job Intelligence backend code for API contracts, authorization, persistence, transaction boundaries, typing, and maintainability.
---

# Backend coding review

Use [backend instructions](../../../backend/AGENTS.md) as the project context.
For an implementation workflow use the [project backend workflow](../job-intelligence-backend/SKILL.md); this skill is
the focused review checklist, not another architecture source.

1. Trace callers and API consumers before proposing a contract change.
2. Check trusted identity, ownership, validated input, safe errors, and serialization
   against [API rules](../../rules/backend-api.md).
3. Check query bounds, indexes, constraints, bigint/date handling, and persistence
   ownership against [database rules](../../rules/backend-database.md).
4. Check atomic writes, retries, resource ownership, and external calls against
   [transaction rules](../../rules/backend-transactions.md).
5. Inspect meaningful comments, explicit types, dependency direction, and reference
   updates. Report concrete findings with severity and file locations.
6. State checks performed and evidence missing. Do not require a new ORM, Redis,
   tenant layer, global error service, or broad rewrite to satisfy this review.
