---
name: ferio-backend-architecture-v2-current
description: Implement or review Ferio NestJS backend changes using explicit multi-tenant, security, structure, scalability, and verification rules.
---

# Ferio Backend Architecture V2

Use this skill for backend implementation, refactoring, or review work in
`ferio-nest-prisma`. The skill is rule-driven: follow the applicable rules,
record evidence, and do not declare completion when a required gate is open.

## Rule Language

- **MUST** means a release-blocking engineering rule unless the task documents
  a reviewed exception.
- **MUST NOT** means a prohibited implementation.
- **SHOULD** means the default choice; deviate only with a reason tied to the
  feature's boundary or measured behavior.
- A static review cannot prove a concurrency target. State tested workload and
  remaining capacity evidence instead of making a performance claim.

## Rule 1: Discover Before Editing

Before changing code, the agent MUST:

1. inspect `src/main.ts`, `src/app.module.ts`, the target module, its tests,
   database client usage, guards, queues, and configuration;
2. identify whether the work belongs to the control plane, tenant plane, or
   shared infrastructure;
3. trace the affected route or job to its service, database client,
   authorization checks, transaction, external calls, and side effects;
4. read the relevant project-flow, architecture, and tracking documents;
5. search all imports, tests, scripts, and documentation references before a
   move or rename.

The agent MUST NOT propose a folder move, service split, or new pattern based
only on the target file.

## Rule 2: Choose The Work Mode

Use the smallest workflow that can safely complete the task:

| Work size | Required workflow |
|---|---|
| Small isolated fix | Inspect, edit, focused test, typecheck, review diff |
| One bounded module | Map routes/dependencies, implement, module tests, full verification |
| Cross-module refactor | Write a short scope/acceptance checklist, migrate atomically, full verification |
| Large feature or multi-session work | Write a durable spec and sliced tickets before implementation |

Do not create ceremony for a one-line fix. Do not implement a cross-module
architecture change from an untracked conversational plan.

## Rule 3: Preserve Boundaries

Ferio has two database planes:

- Platform/control plane: `PlatformPrismaService` and platform services.
- Tenant plane: trusted `TenantContext`, `TenantDbService`, and one tenant
  PostgreSQL database.

The implementation MUST follow these rules:

- Tenant identity MUST come from trusted host/domain resolution.
- A request body, query, route parameter, token claim supplied by the client,
  job payload, or connection string MUST NOT select a tenant database.
- Tenant-only services MUST use `await this.tenantDb.get()` and fail loudly
  outside tenant context.
- `tryGet()` is allowed only at an explicit, documented migration/legacy
  boundary. It MUST NOT hide a fallback to base `PrismaService`.
- Platform services MUST use `PlatformPrismaService` and MUST NOT import tenant
  commerce services to complete ordinary platform operations.
- `TenancyModule` MUST be imported wherever its injected providers are used.
- Cross-plane foreign keys MUST NOT be introduced.

## Rule 4: Follow The Feature Structure

Features are bounded contexts. Use this shape when the role exists:

```text
feature-name/
  feature-name.module.ts
  controllers/                 # multiple/cohesive controllers
  services/                    # multiple/cohesive application services
  dto/
  adapters/ | gateways/        # external integrations
  processors/                  # BullMQ/background workers
  queues/                      # scheduling/enqueueing
  policies/                    # reusable authorization/domain policies
  utils/                       # pure helpers
  tests/                       # feature/submodule-owned tests
```

Structure rules:

- A small one-controller/one-service feature MAY remain flat.
- A complex feature MUST separate roles when authorization, persistence,
  queue, provider, operational, or scaling characteristics differ.
- Tests MUST live in a local `tests/` directory and MUST NOT be mixed with
  production files.
- A feature MUST NOT import another feature's private implementation. Extract a
  shared boundary only when ownership is genuinely shared.
- Runtime feature folders MUST contain executable source only. Historical
  reports belong under `_doc/`.
- New directories MUST use kebab-case.
- Renames and moves MUST preserve module exports, route contracts, provider
  tokens, and public imports in one atomic migration.
- Record structure work in
  `_doc/multi-tenant/skill-related-discussion/file-folder-structure-track.md`.

The agent MUST NOT add empty `controllers/`, `services/`, or other ceremonial
folders merely to make a tree look uniform.

## Rule 5: API And Type Rules

- Routes MUST remain below the configured `/api/v1` prefix.
- Controllers MUST use validated DTOs and typed principals.
- Tenant-admin mutations MUST use the existing `admin/` route convention.
- Domain errors MUST use stable error codes/messages and MUST NOT expose raw
  driver, SQL, provider, credential, or stack-trace details.
- Application-owned values MUST be typed. New explicit `any` is forbidden.
- Use `unknown`, named interfaces, DTOs, Prisma payload/input types,
  discriminated unions, or narrow adapter contracts instead.
- Legacy dynamic boundaries MUST be isolated behind named adapter types and a
  documented migration exception.

## Rule 6: Authorization Is Layered

For protected tenant-admin routes, apply the appropriate existing combination:

```text
AuthGuard -> RolesGuard -> PermissionsGuard -> TenantMembershipGuard
          -> service ownership and domain authorization
```

The service MUST repeat ownership and tenant checks. A controller guard is not
proof that an object belongs to the caller.

- Use permission constants, not ad hoc strings.
- Verify webhook signatures, callback authenticity, tenant binding, replay,
  and idempotency before provider side effects.
- Apply `assertTenantCommerceWritable()` to covered tenant commerce mutations.
- Do not log passwords, tokens, decrypted credentials, payment secrets, or
  unnecessary personal data.

## Rule 7: Mutation Safety

For every multi-record mutation, the agent MUST decide and test:

- transaction boundary;
- state transition and allowed previous states;
- database uniqueness/invariant constraints;
- idempotency key or deterministic deduplication;
- retry and duplicate-delivery behavior;
- audit event and actor metadata;
- suspended/subscription/entitlement behavior;
- external calls outside the database transaction.

Database constraints are part of correctness. Do not rely only on a preceding
read to prevent a race.

## Rule 8: Scalability Is Bounded Capacity

The backend MUST be designed and reviewed as a bounded-resource system:

- HTTP handlers MUST remain stateless and horizontally scalable.
- Tenant Prisma clients, database pools, Redis connections, queue concurrency,
  batches, payloads, file sizes, pagination, report windows, and provider
  timeouts MUST have explicit bounds.
- One tenant's report, retry storm, queue backlog, connection churn, or
  provider outage MUST NOT exhaust capacity for other tenants.
- Large reads MUST use projections, bounded/cursor pagination, aggregation/read
  models, caching, or asynchronous export work as appropriate.
- Slow or retryable work MUST use bounded queues, deadlines, rate limits,
  circuit breakers, backpressure, and safe degradation.
- Network calls MUST NOT run inside database transactions.
- Cache keys, object keys, socket rooms, and job envelopes MUST carry tenant
  identity where collision is possible.
- Worker jobs MUST contain a trusted organization identifier, be idempotent,
  have bounded retries, and produce failure/dead-letter evidence.
- Capacity instrumentation MUST cover latency, errors, saturation, pool usage,
  queue depth/age, retries, circuit state, cache behavior, and rejected work.

The agent MUST NOT claim “supports one million concurrent users” from code
inspection. A capacity claim requires deployment topology, workload definition,
load results, database/Redis/queue limits, and known failure behavior.

## Rule 9: Async And Realtime Context

- Workers MUST NOT depend on request-local AsyncLocalStorage.
- Workers MUST reconstruct tenant context from a trusted organization envelope.
- A job MUST NOT accept a database URL or arbitrary registry ID from an
  untrusted producer.
- Socket tickets MUST be short-lived and bound to the resolved organization.
- Socket rooms and emitted events MUST be tenant-scoped.
- Legacy Mongoose processors and competing queue implementations MUST NOT be
  copied into new Prisma features.

## Rule 10: Verification Gate

Before completion, the agent MUST report which gates passed or failed:

1. focused tests for the changed module;
2. `pnpm exec tsc --noEmit`;
3. full backend test suite with `pnpm test -- --runInBand` when code impact is
   more than a trivial isolated change;
4. production build/lint when the repository task requires it;
5. `git diff --check`;
6. import/reference search for moves, renames, and route changes;
7. relevant tenant-isolation, authorization, concurrency, retry, and failure
   tests;
8. documentation/tracking update for architecture or structure changes.

A failed gate MUST be reported honestly. Do not mark work complete because the
main happy-path test passed.

## Rule 11: Review Method

Reviews MUST report findings first, ordered by severity, with file/line
references. Separate confirmed defects from architectural debt and missing
capacity evidence.

The reviewer MUST inspect:

- direct base-Prisma access in tenant code;
- optional tenant injection and silent fallbacks;
- missing guards, ownership checks, write gates, and audit records;
- unbounded reads, joins, exports, retries, and worker fan-out;
- transaction/network-call boundaries;
- tenant collisions in Redis, jobs, objects, and sockets;
- new explicit `any` and weak adapter contracts;
- test gaps for cross-tenant access, concurrency, and failure recovery.

Use an independent review pass or fresh context for substantial changes when
available. Code authors are often too close to their own implementation to
reliably find omissions.

## Rule 12: Completion Statement

Do not declare a module complete unless the implementation proves:

- database plane and tenant boundary;
- module dependency graph and provider registration;
- route guards and service authorization;
- domain transitions, transactions, idempotency, audit, and write gates;
- bounded/indexed reads and resource limits;
- tenant-safe queues/realtime paths;
- security, failure, and concurrency tests;
- verification commands and remaining evidence gaps.

End every substantial task with a concise summary of changed files, behavior,
verification results, and residual risks. This skill guides engineering; it
does not replace threat modeling, migration review, incident readiness, or
production capacity testing.
