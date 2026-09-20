# Prisma ownership

Neon is the authoritative existing database. `schema.prisma` is introduced by
safe introspection and is not permitted to reset, seed, or recreate data.
`migrations/` records only newly approved forward migrations.
