# Job Intelligence backend

This is the target NestJS + Prisma backend. Its structure follows the relevant
Ferio conventions while remaining explicitly single tenant:

```text
libs/common       shared cross-cutting code
libs/database     bounded Prisma/PostgreSQL connection ownership
prisma/           existing Neon schema mapping and migrations
src/config        validated configuration
src/core          cross-feature application concerns
src/features      bounded Job Intelligence features
src/infrastructure external adapters and operational integrations
src/shared        product-wide types and helpers
```

No `platform/` or `tenancy/` directory exists because Job Intelligence has one
trusted database and no tenant routing requirement. Existing Neon data is
authoritative; automated seeds are prohibited during migration.
