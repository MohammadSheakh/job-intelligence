# Prisma scripts

`build-prisma-schemaV2.js` is a byte-for-byte copy of the Ferio reference builder.
It recursively discovers `.prisma` fragments, sorts base/shared/user/learning
folders first, and emits source comments into `schema.prisma`. Paths are relative
to the script, so invocation does not depend on the working directory.

The local `package.json` declares ESM for these scripts without changing the Nest
application module format. Prettier excludes the upstream V2 file to preserve
exact parity. `build-prisma-schema.mjs` forwards older invocations to V2.

Ferio's obsolete nonrecursive builder, commerce migrations/seeds, and platform
schema are not copied: this application retains its Job Intelligence models and
single-tenant database.
