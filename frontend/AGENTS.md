# Frontend scope

Read [root instructions](../AGENTS.md) first. This file applies to `frontend/`.

## Load only the affected concern

Read [architecture](../.agents/rules/frontend-architecture.md) for component/data
flow changes and [security](../.agents/rules/frontend-security.md) for auth/forms/
links/caching. Use the local [Ferio UI skill](../.agents/skills/ferio-frontend-design/SKILL.md)
for screens, components, responsive layout, or visual review. For high-volume data
flows or capacity claims, read [capacity rules](../.agents/rules/reliability-capacity.md).

## Local architecture and gotchas

This package is Next.js App Router, React, TypeScript, and Tailwind CSS v4. It
calls the separate Nest API; it never connects to PostgreSQL. Inspect installed
versions before applying framework examples. `app/styles.css` owns shared styles;
reuse its patterns and improve touched components without restyling unrelated pages.

Candidate cookie authentication and memory-only admin Basic credentials are
separate flows. `lib/api.ts` and `lib/admin-api.tsx` are existing integration
boundaries. Preserve status/code-based candidate redirects and the admin
sign-in lifecycle. Server rendering is a tool, not a reason to invent another
session system or copy database business rules into Next.

## Verification

From the repository root: `pnpm --dir frontend typecheck`,
`pnpm --dir frontend build`, `pnpm check:style`. When browser work is authorized,
review the affected flow at desktop/narrow widths, keyboard navigation, and
loading/error/empty states. Existing browser checks run from the backend package;
see [test README](../backend/test/README.md). Report visual/runtime checks not run.
