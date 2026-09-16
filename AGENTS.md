# Project documentation

Before changing product behavior, read `PRD.md` and
`IMPLEMENTATION_CHECKLIST.md`. Update both when scope or behavior changes.
Checklist completion claims require verification appropriate to the task.

Read `docs/DATABASE_SWITCHING.md` for database-mode operations.
Local and Neon databases are independent; switching does not synchronize data.

Treat `docs/brutal_*` as the initial plan and `docs/final_*` as supporting
snapshots. Use the root PRD and checklist for current requirements and status.

## Agent skills

### Issue tracker

Track specs and tickets as local Markdown under `.scratch/<feature>/`.
Read `docs/agents/issue-tracker.md` before creating or updating tickets.

### Triage labels

Use the five default triage roles.
Read `docs/agents/triage-labels.md` before triaging tickets.

### Domain docs

Use single-context documentation: root `CONTEXT.md` and `docs/adr/`.
Read `docs/agents/domain.md` before exploring the codebase.
