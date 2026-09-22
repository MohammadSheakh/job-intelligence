---
name: job-intelligence-backend
description: Implement or review backend features in the Job Intelligence NestJS/Prisma application. Use for backend modules, authorization, persistence, transactions, recommendations, Quick Search, crawling, migration from legacy/Ferio behavior, or cross-module backend architecture.
---

# Job Intelligence backend workflow

Read [backend instructions](../../../backend/AGENTS.md) first.

Treat repository guidance in this order:

1. `backend/AGENTS.md` and linked rules define coding and architectural constraints.
2. `backend/prisma/AGENTS.md` defines Prisma/database-specific constraints.
3. `docs/BACKEND_DEVELOPER_GUIDE.md` describes current implementation flows,
   behavioral contracts, known limitations, and migration state.
4. Legacy/Ferio code is behavioral evidence only; do not copy its architecture
   automatically.
5. This skill coordinates the workflow; it does not override repository rules.

## Load project context selectively

Read only the relevant section of
[backend developer guide](../../../docs/BACKEND_DEVELOPER_GUIDE.md):

- Request/auth work → `Following a request`
- Candidate/pipeline/settings behavior → `Business rules that need context`
- Recommendation work → `Recommendation request flow`
- Quick Search/quota/company selection → `Quick Search quota and company selection`
- Prisma/schema work → [database architecture](../../../docs/DATABASE_ARCHITECTURE.md)
- API contract changes → [API compatibility](../../../docs/BACKEND_API_CONTRACTS.md)
- Crawler persistence → `Crawler ingestion boundary`
- HTTP fetching/security → `HTTP crawler transport`
- Scheduled/daily crawling → `Daily command and source orchestration`

Do not load the entire guide when the change concerns only one subsystem.

## Workflow

1. Trace the affected caller through authorization, service/domain logic, persistence,
   side effects, and consumers. Distinguish legacy behavior from implementation choices.
2. Use the existing boundary for small fixes. For a new cross-module use case,
   identify ownership, atomicity, retry behavior, compatibility, and capacity limits.
   Repository rules govern those decisions; this skill does not redefine them.
3. Implement the coherent change and migrate affected references together. Keep
   deliberate architecture changes separate from incidental template preferences.
4. Run permitted checks and review the changed flow for authorization, failure,
   concurrency, and data compatibility. State missing evidence honestly.
5. Update the relevant implementation documentation when behavior changes. For
   reviews, separate defects, architectural debt, and missing verification.

This workflow authorizes no external actions.
