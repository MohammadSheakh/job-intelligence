# Job Intelligence MVP

A TypeScript/Node.js job-intelligence application for curated Bangladesh company research, daily career-page monitoring, candidate matching, candidate application tracking, optional AI, and email digests.

The Admin and Candidate portals run in the **same application and database**, but they have different authentication and views. Both follow the shared Ferio design system.

## Project truth documents

Before changing behavior, read:

- [`PRD.md`](PRD.md) — product requirements and scope
- [`IMPLEMENTATION_CHECKLIST.md`](IMPLEMENTATION_CHECKLIST.md) — what is done, partial, and pending
- [`docs/DATABASE_SWITCHING.md`](docs/DATABASE_SWITCHING.md) — Local Docker <-> Neon operations

When a feature changes, update the PRD and checklist in the same change.

Structural PRD guard:

```sh
npm run prd:audit
```

## Fastest local setup: Docker

You need Docker Desktop on Windows/macOS, or Docker Engine + Compose on Linux. You do not need Node.js or PostgreSQL installed on the host.

### Start with local Docker PostgreSQL

Windows:

```bat
start-local.cmd
```

macOS/Linux:

```sh
./start-local.sh
```

Equivalent:

```sh
docker compose -f compose.yaml up --build -d --remove-orphans
```

Open:

- Admin: `http://localhost:3000`
- Candidate login: `http://localhost:3000/portal/login`
- Health: `http://localhost:3000/health`

Private-local defaults:

```text
Admin username: admin
Admin password: asdfasdf
New candidate default password: asdfasdf
```

Change development defaults before exposing the application to other people or a public network.

## Switch database: Local <-> Neon

The application code does not change when the database changes.

### Local Docker database

```sh
./switch-db.sh local
```

Windows:

```bat
switch-db.cmd local
```

### Neon database

Put the Neon connection string in the local, gitignored `.env`:

```env
DATABASE_URL=postgresql://...neon.tech/...?...sslmode=require
```

Then:

```sh
./switch-db.sh neon
```

Windows:

```bat
switch-db.cmd neon
```

The Admin sidebar shows `DB LOCAL` or `DB NEON`. `/health` also returns `databaseMode`.

Verify from the running container:

```sh
docker compose exec app npm run db:status
```

For Neon mode:

```sh
docker compose -f compose.neon.yaml exec app npm run db:status
```

**Switching does not synchronize data.** Local Docker and Neon are independent databases. See [`docs/DATABASE_SWITCHING.md`](docs/DATABASE_SWITCHING.md).

## Docker services

Local `compose.yaml` starts:

1. `db` — PostgreSQL 16 with named-volume persistence.
2. `app` — Admin + Candidate portal.
3. `scheduler` — daily crawler + notification worker.

On the first empty local database, bootstrap creates the schema and seeds the packaged company/category dataset. Existing local data is preserved on normal restart.

Useful commands:

```sh
docker compose logs -f app
docker compose logs -f scheduler
docker compose down
docker compose up -d
```

Delete the **local Docker database** only when intentionally resetting it:

```sh
docker compose down -v
```

## Application areas

### Admin

Admin routes include:

- `/` Dashboard
- `/companies`
- `/categories`
- `/jobs`
- `/candidates`
- `/crawl-logs`
- `/settings`

Admin authentication uses HTTP Basic Auth from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### Candidate

Candidate routes include:

- `/portal/login`
- `/portal`
- `/portal/companies`
- `/portal/pipeline`
- `/portal/profile`
- `/portal/change-password`

Candidate accounts are admin-created. New candidates receive `DEFAULT_CANDIDATE_PASSWORD` (currently `asdfasdf`) if no password exists, stored only as a `scrypt` hash, and must change it on first login.

Google login is optional and only binds an existing active candidate with a matching verified email.

## Candidate workflow

Candidates can:

- see ranked job recommendations
- run Standard Quick Search
- run AI-assisted Quick Search when AI is enabled/configured
- add companies to Planning
- mark companies Applied
- set latest application date
- update re-apply count
- add notes
- Blacklist a company
- edit their matching profile

Blacklisted companies are suppressed from that candidate's recommendations.

## Quick Search defaults

Stored in `settings` and editable by Admin:

```text
quick_search_daily_limit = 3
quick_search_ai_daily_limit = 1
quick_search_company_limit = 8
```

Usage is stored in `candidate_search_runs`, so restart does not bypass the limit. Daily boundaries use Asia/Dhaka.

## Company categories and NHPF

Companies are many-to-many with categories through `categories` and `company_categories`.

Category types:

- `technology`
- `domain`
- `sector`
- `other`

`NHPF` means **No Hiring Page Found**. It is workflow/research status, not a category. NHPF companies are excluded from normal monitor-ready crawling until a valid hiring page is found.

Preview/apply conservative non-AI category enrichment:

```sh
npm run categories:enrich
npm run categories:enrich -- --limit=100
npm run categories:enrich -- --apply --threshold=0.85
```

## Crawling

Primary crawler: `fetch + Cheerio` with source overrides for exceptions.

Run a bounded crawl:

```sh
CRAWL_LIMIT=10 npm run crawl:daily
```

Run all monitor-ready companies:

```sh
npm run crawl:daily
```

The scheduler defaults to approximately 06:15 Asia/Dhaka.

The system deliberately does not auto-close a job after one missing crawl.

## Matching

Core matching works with AI disabled and considers:

- expertise/job family
- skills
- location
- experience
- work mode
- preferred/excluded categories
- capped company-category context

Hard exclusions are evaluated before AI. Excluded location is a hard rejection. Sector exclusions are hard filters. Technology/domain exclusions reject only when the job itself matches the excluded category.

Preview matches:

```sh
npm run match:preview
```

## AI

AI is optional. Admin settings control:

- `ai_enabled`
- `ai_matching_enabled`
- `ai_daily_limit`
- `ai_skill_extraction_enabled`

AI uses an OpenAI-compatible endpoint and falls back to deterministic matching on provider failure.

Environment:

```env
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=
AI_API_KEY=
```

## Email

SMTP email is optional. When disabled, matching/portal behavior continues normally.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

Run the digest worker:

```sh
npm run notify:daily
```

Notification rows are recorded after successful delivery to prevent duplicate alerts.

## Database schema

Current runtime tables:

1. `companies`
2. `jobs`
3. `candidates`
4. `notifications`
5. `settings`
6. `crawl_logs`
7. `categories`
8. `company_categories`
9. `candidate_auth`
10. `candidate_company_state`
11. `candidate_search_runs`

No persistent `matches` table or queue/Redis layer is required for the MVP.

## Migrations and bootstrap

Manual non-Docker flow:

```sh
npm install
cp .env.example .env
npm run env:check -- --mode=server
npm run db:migrate
npm run db:migrate:portal
npm run db:verify
npm run admin
```

Docker startup uses `scripts/docker-bootstrap.ts` and `sql/008_runtime_schema.sql` to ensure runtime schema exists. Empty local databases receive the packaged company/category seed.

`sql/003_seed_verified_pilot_jobs.sql` contains only the 20 verified pilot jobs used by the controlled live pilot; the earlier unverified Genex bulk set is not included.

## Add a candidate from CLI

```sh
npm run candidate:add -- \
  --name "Mohammad" \
  --email "mohammad.sheakh@gmail.com" \
  --expertise "Backend Engineer, AI Engineer" \
  --skills "Node.js, NestJS" \
  --preferred-categories "Node.js, NestJS, Backend, AI" \
  --threshold "70"
```

Existing email updates the candidate. A missing candidate password is initialized from `DEFAULT_CANDIDATE_PASSWORD` and flagged for change.

Reset an existing candidate to the configured default password:

```sh
npm run candidate:set-default-password -- --email user@example.com
```

## Environment safety

`.env` is gitignored and excluded from Docker image build context. Distributed builds must not contain live Neon credentials, Google secrets, SMTP passwords, AI keys, or production session/admin secrets.

Important variables:

```env
DATABASE_URL=
DATABASE_MODE=unknown
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
DEFAULT_CANDIDATE_PASSWORD=asdfasdf
CANDIDATE_SESSION_SECRET=
PUBLIC_BASE_URL=http://127.0.0.1:3000
COOKIE_SECURE=false
```

Validate configuration:

```sh
npm run env:check -- --mode=server
npm run env:check -- --mode=worker
```

## Ferio design

`src/ui/ferio.ts` is the shared UI layer. Admin and Candidate use different navigation/content while sharing the same visual language: grayscale-first surfaces, hairline dividers, black primary pill actions, restrained semantic status colors, no gradients/glass/shadows, direct copy, and responsive layouts.

## Production-readiness status

Do not infer production completion from source existence alone. External integrations and broad runtime coverage are tracked honestly in [`IMPLEMENTATION_CHECKLIST.md`](IMPLEMENTATION_CHECKLIST.md), including Docker runtime validation, Google OAuth, SMTP, AI provider validation, broad crawler coverage, browser QA, and public hosting/TLS.
