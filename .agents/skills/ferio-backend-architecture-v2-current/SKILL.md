---
name: ferio-backend-architecture-v2-current
description: Implement or review Job Intelligence NestJS/Prisma backend features using the locally adapted Ferio structure, authorization, transaction, and bounded-capacity workflow.
---

# Ferio backend workflow for Job Intelligence

This is the project-local adaptation, not the adjacent Ferio application's
multi-tenant/control-plane architecture. Start with [backend instructions](../../../backend/AGENTS.md).
Read only relevant details from the linked API, database, and transaction rules.

## Discover

Trace the target route/command and callers through guards, DTOs, services, domain
policy, persistence, and side effects. Inspect module registration, existing tests,
installed dependencies, and [developer guide](../../../docs/BACKEND_DEVELOPER_GUIDE.md).
For migration work, verify current scope in the handoff; legacy implementation is
behavioral evidence, not automatically a pattern to copy.

## Decide the boundary

For a small fix, change the existing boundary. For a feature, write a brief
acceptance list including auth, persistence, failure behavior, and affected
consumers. For a cross-module change, explain dependency direction, compatibility,
and rollout before editing. Create a durable spec only when the work warrants it.

Use feature modules with the roles that exist: controllers, services, DTOs, pure
domain helpers, repositories for substantial persistence, and adapters for external
I/O. Use installed infrastructure. Queues, caching, tenancy, and distributed units
of work are design decisions, not mandatory folders or implicit dependencies.

## Implement and review

- Controllers delegate; services express use cases; data access follows backend scope.
- Candidate identity is session-derived; candidate and admin authorization stay separate.
- Specify transaction membership, uniqueness, valid transitions, idempotency, and
  failure recovery for mutations. Keep external I/O outside transactions.
- Bound queries, page sizes, payloads, connections, retries, job fan-out, and deadlines.
  Distinguish per-process controls from distributed guarantees. Explain residual cost.
- Preserve Prisma mappings, bigint safety, legacy behavior, and schema/data constraints.
- Use explicit types at boundaries and comments for responsibilities/invariants.
  Avoid generic wrappers, broad catch/rethrow boilerplate, and unmeasured scale claims.
- Search all references when renaming/moving; migrate consumers and registration together.

## Verify and hand off

Use root/package instructions for appropriate checks. Respect explicit test deferral;
report unverified auth/rollback/concurrency behavior and never turn old results into
claims about the new change. Review the final diff, update affected product/status
docs, and report remaining work. Source completion and deployment readiness differ.
For reviews, lead with actionable findings and file locations; separate defects,
architectural debt, and missing evidence. This workflow authorizes no external actions.
