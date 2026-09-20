# Workspace and delivery foundation

Status: claimed
Type: task
Triage: platform
Blocked by: none

## Scope

Create the pnpm workspace, Nest API and Next web application foundations,
baseline configuration, route prefix, health endpoint, and migration runbook.

## Acceptance

- Workspace commands discover both applications.
- API uses `/api/v1`, validates input globally, has CORS allow-list and a
  bounded database health check.
- Web application has a typed API boundary and does not connect to PostgreSQL.
- Existing runtime is explicitly retained pending feature-parity cutover.

## Comments

- Claimed 2026-09-20 after route/dependency and architecture audit.
- 2026-09-20: workspace, API health boundary, web API client, and a draft
  Prisma map were created. Dependency installation and type/build verification
  are the remaining acceptance items for this ticket.
- 2026-09-20: fixed CommonJS middleware interop found by the runtime smoke
  test; verification is being repeated.
