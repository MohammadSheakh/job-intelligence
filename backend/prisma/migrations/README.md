# Prisma migration history

`0_initial` creates the current schema on an empty database and preserves the five
legacy CHECK constraints not represented by Prisma. Existing Neon adoption is pending:
never execute the baseline SQL on populated tables or mark it applied without schema
comparison. See [adoption workflow](../_doc.md). Forward changes after release belong
in new migration directories; update the reviewed SHA-256 manifest for new artifacts.
