# Domain documentation

## Layout and reading rules

This is a single-context repository.

Before exploring code:
- Read root `CONTEXT.md`, if present.
- Read relevant decisions under `docs/adr/`, if present.
- Read `PRD.md` for product requirements and
  `IMPLEMENTATION_CHECKLIST.md` for recorded implementation status.

If domain documentation is absent, proceed silently.
The domain-modeling skill creates it when terms or decisions are resolved.

## Vocabulary

Use the terms defined in `CONTEXT.md` when naming domain concepts.
Until a glossary exists, follow terminology in `PRD.md`.
Note meaningful vocabulary gaps for domain modeling.

## Decisions

Explicitly identify proposals that contradict an existing ADR.
Explain why the decision should be reconsidered.
