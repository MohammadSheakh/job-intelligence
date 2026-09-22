# Agent instruction system

## Ownership and reading order

The portable entry point is root `AGENTS.md`. Use that exact plural filename.
Nested files explicitly link to their parents; editors that do not discover nested
instructions automatically can still follow the same reading path. Rule Markdown
is loaded through these links, not through an assumed editor-specific trigger.

| Surface | Owns | Load when |
| --- | --- | --- |
| Root `AGENTS.md` | Repository map, authority, safe workflow, verification/delivery | Every task |
| `backend/AGENTS.md` | Actual Nest/Prisma boundaries and backend routing | Editing/reviewing backend |
| `frontend/AGENTS.md` | Actual Next/API boundaries and UI routing | Editing/reviewing frontend |
| `backend/prisma/AGENTS.md` | Generated schema, exact builder, migration/seed safety | Prisma files or database operations |
| `.agents/rules/backend-*.md` | API, database, transaction constraints | Corresponding backend concerns |
| `.agents/rules/frontend-*.md` | Component/data flow and security constraints | Corresponding UI concerns |
| Job Intelligence backend skill | Discover/implement/review/handoff workflow | Backend feature or architecture work |
| Backend coding standards skill | Focused code-review checklist | Backend review |
| Ferio frontend design skill | Product composition, visual language, accessibility | Screen/component design or review |
| PRD / checklist / migration handoff | Product behavior / evidence / next work | Relevant product or migration task |

Rules describe constraints; skills describe workflows; status docs describe
implementation evidence. Keep each subject's authority in one place and link to
it. Generic installed skills are optional supporting references, not permission
to override this application's architecture or the user's scope.

Other bundled skills (research, specs, tickets, TDD, handoff, etc.) remain available
on demand. They are not an always-loaded checklist for every change. Do not load
all skills recursively or create specs/tickets for routine small fixes.

## Optional planning and historical context

For domain decisions, read root `CONTEXT.md` and relevant `docs/adr/` entries when
present. For durable multi-session planning use the existing docs; when the task
actually needs tickets, use [issue tracking](issue-tracker.md). Load
[triage](triage-labels.md) for triage and [domain guidance](domain.md) for domain work.
Routine code changes do not require these workflows.

`docs/brutal_*` and `docs/final_*` are historical/supporting reports. Accepted Figma
refinements originated in `docs/gpt-conversation/gpt1.md` and are tracked by the
current product/migration docs; do not reload the whole conversation for each task.

## Refine from observed corrections

When changing an `AGENTS.md`, retain local invariants that prevent real failures.
Move optional depth behind a task-specific pointer instead of deleting it to reach
a line target. Keep scope, relevant commands, consumer contracts, and operational
gotchas discoverable. The four scoped files need not have identical length.

Use a concrete mismatch between produced work and the intended result: identify
its cause, change the narrowest responsible instruction, and review both a task
that should trigger it and one that should not. One-off preferences do not become
universal rules. Remove superseded copies and check links after moves. Preserve
reasoning for an important decision in project docs rather than a growing preamble.

Review third-party skill instructions and executable resources before installing
or updating them; popularity is not evidence of safety. Preserve provenance/license
information. Skill metadata and prose do not themselves enforce tool permissions.
Use scripts for repeatable operations, not to turn subjective design judgment into
an arbitrary numeric gate. Structural checks complement human review of actual
outputs; they do not certify engineering quality.

## Audit findings resolved

- The local Ferio V2 skill referred to the adjacent multi-tenant commerce product,
  including absent platform/tenant services and tracking paths. Its replacement, `job-intelligence-backend`, now targets
  this repository while preserving useful boundary/capacity principles.
- Backend rules and a duplicate skill required Drizzle, Redis, soft deletion on
  every model, an absent ErrorService, and universal transaction infrastructure.
  They now distinguish current Prisma patterns from deliberate future decisions.
- API examples prescribed a new nested error shape while the frontend consumes
  top-level message/code fields. Rules now require coordinated contract changes.
- Both frontend rule files were empty. They now cover architecture and security;
  a local design skill covers Ferio UI, state handling, and accessibility.
- A reference used another developer's absolute filesystem path. Local links now
  resolve inside this repository. The handoff routes frontend work to the local skill.
- Global test mandates conflicted with explicit test deferral. Guidance now distinguishes
  verification defaults from session instructions and requires honest evidence gaps.

This is an instruction-only change. It does not refactor existing services,
standardize all historical endpoints, validate security, or finish migration milestones.

## Separation of policy and project facts

Keep scoped `AGENTS.md` files small: routes to context and local invariants that
change decisions. Reusable rules carry policy; docs carry current architecture,
commands, contracts, and migration state. Skills coordinate relevant workflows
and link deeper references by need. A repository-local rule can be portable.

- Database/tooling facts: [database architecture](../DATABASE_ARCHITECTURE.md).
- API compatibility facts: [API contracts](../BACKEND_API_CONTRACTS.md).
- Sibling tooling comparison: [Ferio reference](../FERIO_PRISMA_REFERENCE.md).
- Security examples: topic references under the security skill, loaded selectively.

When a skill is renamed, update callers and its UI default prompt. When moving a
document, resolve links relative to the new directory. Keep a single scoped entrypoint;
replace superseded instructions rather than appending a second version.

## Maintenance

When changing an instruction, inspect the affected root/scoped/rule/skill chain
and package scripts. Resolve conflicting copies instead of appending another
unqualified MUST. Preserve historical architecture decisions as history, not active
instructions. Use repository-relative links and precise activation descriptions.
Avoid mandatory tools, dependencies, architecture, or approval gates that do not
exist in the project. Add a deeper AGENTS.md only for a meaningful scoped difference.

Run `pnpm check:agents` for structural checks. For substantial changes use
[engineering evidence](engineering-evidence.md) and
[capacity rules](../../.agents/rules/reliability-capacity.md).

For skill changes, validate frontmatter and reference paths, then review realistic
requests below. For code changes, use the applicable package validation workflow.
Do not run live database/crawler operations as an instruction smoke check.

| Review scenario | Expected decision |
| --- | --- |
| Fix one candidate guard | Keep single-tenant principal scoping; no tenant database scaffolding |
| Add an admin catalog filter | Trace DTO/service/client; bound inputs and retain catalog response shape |
| Implement a multi-write feature | Choose an explicit atomic boundary; keep provider calls outside it |
| Edit a Prisma fragment | Build/generate; preserve mappings; do not apply a Neon migration or seed implicitly |
| Build a candidate screen | Read frontend/design/security guidance; preserve API/auth ownership |
| Improve a form on mobile | Labels, focus, errors, pending state, overflow, existing visual tokens |
| User asks to skip tests | Respect the request, run permitted static checks, report runtime gaps |
| Small documentation correction | Fix relevant text/links; no new framework, ticket system, or application suite |
| Agent starts in a package directory | Follow its parent link and load root plus scoped instructions |
| User asks for one million users | Define workload and resource budget; no capacity claim without measurements |
| Worker retries a timed-out operation | Bound retries and concurrency; inspect duplicate effects and durable outcome |
| A template recommends another ORM or queue | Preserve installed boundaries unless the actual requirement justifies a change |
| User asks for a commit/push | Use the existing skill within session authorization and review staged changes |

These scenarios were reviewed against the written guidance, not executed as
independent agent evaluations. Successful parsing does not prove agent behavior;
maintain the guidance using concrete failures observed in later tasks.

## Source references and limitations

- [AGENTS.md convention](https://agents.md/) recommends nested package instructions.
- [VS Code instruction documentation](https://code.visualstudio.com/docs/agent-customization/custom-instructions)
  documents tool-specific discovery; nested support can vary by client/settings.
- [Next.js server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components)
  explains composition and client bundle boundaries. Apply APIs compatible with
  the installed Next version, not automatically the latest documentation version.

Instructions improve consistency but cannot guarantee senior judgment, security,
scalability, or production readiness. Those require code review and relevant runtime
evidence; the migration scorecard remains separate.
