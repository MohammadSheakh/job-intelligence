# Engineering evidence and scope

This document defines how to review agent work; it does not certify the application.
Load it for substantial architecture/reliability changes or production-readiness claims.
Use [capacity rules](../../.agents/rules/reliability-capacity.md) for engineering policy.

## Evidence proportional to the change

| Change | Review evidence | Additional runtime evidence when authorized |
| --- | --- | --- |
| Instructions/docs | Links, skill metadata, commands, scope/contradiction review | Scenario evaluation when instructions materially change decisions |
| API/auth | Caller/consumer trace, trusted identity, compatibility, static checks | Unauthorized ownership, session expiry, validation and error paths |
| Atomic persistence | Invariant, constraints, transaction participation, bounded queries | Rollback, concurrent writes, retry/duplicate execution on isolated data |
| Worker/external I/O | Deadline/concurrency/retry budgets, durable outcomes, cleanup | Crash recovery, throttling, partial failure, saturation |
| UI | Consumer contract, state transitions, secret/cache boundaries | Keyboard/narrow layout, loading/error/empty states, interrupted requests |
| Schema/deployment | SQL review, compatibility order, target/history, recovery plan | Isolated replay/backfill, restore, rollout/rollback exercise |
| Capacity | Workload and resource model with explicit assumptions | Representative sustained/burst load with latency, errors, saturation and cost |

Explicitly deferred checks remain evidence gaps, not permission to label work
verified. Do not run production mutations or provider traffic as a substitute for
an isolated check. Report pre-existing failures separately.

## Current application boundary

The [migration handoff](../ARCHITECTURE_MIGRATION_STATUS.md) owns replacement progress.
The PRD defines product requirements; its legacy completion statement is not a
replacement readiness claim. The implementation checklist records acceptance evidence
for both legacy and replacement sections. Read only the relevant sections.

There is currently no measured million-user capacity target established by these
instructions. Before planning that target, define active/concurrent usage, Quick Search
frequency, crawl volume, dataset size, provider limits, latency, availability, and cost.
Retain the current architecture until evidence supports a specific change.

## Review outcome

A useful handoff states the behavior delivered, compatibility and failure boundaries,
checks actually performed, missing evidence, and deployment prerequisites. Distinguish
implemented, statically checked, runtime verified, and operationally validated.
Do not require a fixed report template for small changes.

## Instruction integrity check

Run `pnpm check:agents` from the repository root. The dependency-free checker covers
local links in all `.agents/` Markdown plus scoped instructions and selected project docs, required
skill frontmatter fields across local skills, and skill UI invocation names. CI runs
it independently of application tests, followed by
`node .agents/scripts/verify-instruction-checker.mjs`, which injects broken links,
skill names, and invocation metadata into a disposable copy. It does not parse every Markdown/YAML feature,
fetch external links, prove policy consistency, or evaluate agent judgment.

New `.agents/` Markdown is discovered automatically. When adding project docs to
the maintained set, update the checker's explicit entry list.
Scenario review in [instruction maintenance](instruction-system.md) complements the
structural check. Record failures from real tasks and make narrow corrections instead
of adding generic rules to every entrypoint.
