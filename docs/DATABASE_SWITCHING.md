# Database switching: Local Docker <-> Neon

The application supports two database modes without changing application code.

## Local Docker PostgreSQL

Local mode runs PostgreSQL in Docker and stores data in the named volume `job_intelligence_pgdata`.

Windows:

```bat
start-local.cmd
```

macOS/Linux:

```sh
./start-local.sh
```

Equivalent command:

```sh
docker compose -f compose.yaml up --build -d --remove-orphans
```

The application container receives:

```text
DATABASE_MODE=local
DATABASE_URL=postgresql://jobapp:...@db:5432/job_intelligence
```

The local database is bootstrapped only when empty. Docker restarts preserve its volume.

## Neon

Put the Neon connection string only in the local `.env` file:

```env
DATABASE_URL=postgresql://...neon.tech/...?...sslmode=require
```

Then switch:

Windows:

```bat
start-neon.cmd
```

macOS/Linux:

```sh
./start-neon.sh
```

Equivalent command:

```sh
docker compose -f compose.neon.yaml up --build -d --remove-orphans
```

The Neon stack receives `DATABASE_MODE=neon` and uses `DATABASE_URL` from `.env`.

## One-command switching

```sh
./switch-db.sh local
./switch-db.sh neon
```

or on Windows:

```bat
switch-db.cmd local
switch-db.cmd neon
```

The switch script stops the active stack first, so the local and Neon variants do not compete for port 3000.

## Verify which database is active

From inside a running app container:

```sh
docker compose exec app npm run db:status
```

For Neon mode:

```sh
docker compose -f compose.neon.yaml exec app npm run db:status
```

The `/health` endpoint also returns `databaseMode`.

The Admin sidebar displays `DB LOCAL` or `DB NEON`.

## Important: switching is not synchronization

Local Docker and Neon are two independent databases. Switching changes which database the application uses. It does not copy candidates, pipeline states, jobs, crawl history, or settings between them.

Use local mode for isolated development/testing. Use Neon when several machines should see the same shared data.

If shared continuity is required across machines, prefer Neon rather than creating a separate local database on each machine.

## Safe workflow

1. Keep `.env` out of Git and ZIP files.
2. Put the Neon connection string in `.env` only on machines that should access Neon.
3. Run `switch-db.* neon` to use shared Neon data.
4. Run `switch-db.* local` to return to isolated Docker PostgreSQL.
5. Run `npm run db:status` after switching when there is any doubt.
6. Do not use `docker compose down -v` unless you intentionally want to erase the local Docker database.
