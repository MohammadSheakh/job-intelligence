# Seed sources

`catalog.ts` validates the canonical company CSV and parses category/assignment
VALUES from existing curated SQL without executing it. All source files stay intact.
`../seed.ts` previews by default and performs insert-only batches only with `--apply`
and explicit `SEED_DATABASE_URL`. See [workflow and adoption policy](../_doc.md).
