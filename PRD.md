# Job Intelligence - Product Requirements Document

**Status:** MVP feature-complete in code; deployment/integration validation remains for external services and broad crawler coverage.  
**Primary market:** Bangladesh technology job search.  
**Design system:** Ferio grayscale-first operations/product interface.  
**Runtime:** One Node.js application with separate Admin and Candidate views, PostgreSQL, daily worker, optional AI, optional SMTP, optional Google OAuth.

## 1. Product goal

Build a low-cost job intelligence system that starts from a curated company dataset, checks company hiring pages, extracts current jobs, matches those jobs to candidates, and helps each candidate manage a personal company/application pipeline.

The system must remain useful with AI disabled. AI is an optional ranking enhancement, not a dependency for crawling or core matching.

## 2. Users and access

### Admin

Admin uses a separate operations view in the same application. Admin authentication is HTTP Basic Auth configured through environment variables.

Admin must be able to manage companies, company categories, jobs, candidates, candidate preferences, crawler status/logs, and system settings.

### Candidate

Candidate uses `/portal/*`, not the admin view. Candidate can sign in with email/password. Google OAuth is optional. Candidate accounts are admin-created; Google sign-in may bind only to an existing active candidate with the same verified email.

New candidate accounts receive the configured default password (`asdfasdf` by current product decision), stored only as a password hash, and must change it after first login.

## 3. Company intelligence

Companies originate from the curated XLSX/CSV research dataset. Duplicates are consolidated rather than blindly removed.

A company can have multiple categories. Category types are:

- technology
- domain
- sector
- other

Category assignments may be inferred from source data, enriched from explicit evidence, or manually confirmed by admin.

`NHPF` means **No Hiring Page Found**. It is workflow/research status, not a technology/domain/sector category. NHPF companies must not be included in the normal daily career-page crawl until a valid hiring page is found.

## 4. Crawling and jobs

The scheduled crawler runs once per day, approximately 06:15 Asia/Dhaka by default.

Primary crawler: HTTP fetch + Cheerio. Custom source overrides/adapters are allowed only where generic extraction is insufficient. Anti-bot protections must not be bypassed.

The crawler operates on monitor-ready companies with a career URL. It records crawl logs and upserts jobs using stable hashes.

The system prefers missing an uncertain job over creating a stale/false job.

Jobs are not automatically closed after one missing crawl until crawler reliability is strong enough to make that safe.

## 5. Matching

Core deterministic match factors:

- expertise/job family
- skills
- location
- experience
- work mode
- candidate preferred/excluded categories
- small company-category context bonus

Hard exclusions always win over positive scoring and AI.

Excluded locations are hard rejections. Sector exclusions are hard filters. Technology/domain exclusions reject only when the actual job matches that excluded category, not merely because the company has that technology somewhere.

Company-category context is capped and cannot turn an unrelated job into a match.

## 6. AI

AI is optional and controlled by admin settings.

AI may enhance semantic matching and skill interpretation. The core crawler and deterministic matcher work without AI.

Candidate Quick Search offers Standard and AI-assisted modes. AI-assisted search is unavailable when AI is disabled or unconfigured.

## 7. Candidate profile

Candidate profile supports:

- name
- email (login identity; candidate view is read-only)
- expertise
- skills
- experience level
- preferred locations
- excluded locations
- preferred work modes
- preferred categories
- excluded categories
- minimum match score

Candidates can edit their own non-email profile fields.

## 8. Candidate company/application pipeline

Each candidate can independently place a company in:

- Planning
- Applied
- Blacklist (stored internally as `EXCLUDED`)

Per-candidate company state includes latest application date, re-apply count, and notes.

Blacklisted companies are suppressed from that candidate's recommendations.

## 9. Quick Job Search

Normal crawling remains once daily. A candidate may request a limited on-demand refresh.

Current defaults:

- 3 quick searches per candidate per Asia/Dhaka day
- maximum 1 AI-assisted quick search per day
- maximum 8 relevant companies checked per quick search

Limits are persisted in PostgreSQL so restarting the application cannot reset them. Admin can change the limits.

## 10. Notifications

The system supports candidate email digests through SMTP when enabled. A notification record is written after successful delivery so jobs are not repeatedly emailed to the same candidate.

SMTP is optional; disabling email must not break matching or the portal.

## 11. Admin application

Admin pages:

- Dashboard
- Companies
- Categories
- Jobs
- Candidates
- Crawler logs/status
- Settings

Company admin supports multi-category assignment and NHPF/recommended-action editing. Candidate admin supports profile fields and authentication initialization.

## 12. Candidate application

Candidate pages:

- Login
- Dashboard/recommendations
- Quick Search
- Companies
- Pipeline
- Profile
- Change password
- Google OAuth callback/start when configured

Recommendation and Quick Search results provide direct workflow actions: Apply, Plan, Applied, Blacklist.

## 13. Ferio UI requirements

All frontend work follows the Ferio language:

- grayscale-first (`#111114`, `#6e6e73`, `#e8e8ea`, `#fafafa`, `#ffffff`)
- semantic muted color only for statuses
- neutral grotesk/Inter-style typography
- generous whitespace except operational tables
- black primary pill buttons with white text
- approximately 10px radii for controls/cards
- hairline dividers instead of shadows
- no gradients, glassmorphism, decorative shadows, mascots, or decorative motion
- direct UI copy
- mobile-safe layouts

Admin and Candidate share the design system but have different views and navigation.

## 14. Database modes

The same application supports:

- local Docker PostgreSQL for isolated development
- Neon PostgreSQL for shared/persistent cloud data

Switching modes must not require code edits. The project provides `switch-db`/`start-local`/`start-neon` launchers and exposes the active mode through Admin and `/health`.

Switching databases does **not** synchronize data. Local and Neon remain separate stores.

## 15. Docker/local portability

A new machine should require only Docker Desktop (or Docker Engine + Compose) plus the project folder.

Local mode starts:

- PostgreSQL
- application server
- daily scheduler

The local database uses a named volume. Bootstrap is idempotent and seeds the packaged company/category dataset only when the database is empty.

## 16. Security requirements

- never commit or package live database passwords/API secrets
- `.env` is gitignored/dockerignored
- candidate passwords use `scrypt` hashes
- candidate sessions use signed expiring cookies
- Google sign-in requires verified email and an existing candidate
- secrets come from environment variables
- production deployments require HTTPS and strong admin/session secrets
- hard candidate exclusions cannot be overridden by AI

## 17. Explicit non-goals for this MVP

- Redis/queues
- microservices
- Kubernetes
- automated bypass of anti-bot challenges
- automatic synchronization between Local PostgreSQL and Neon
- automatic closing of a job after one missing crawl
- open public candidate registration

## 18. Acceptance criteria

The MVP is accepted when the codebase satisfies all product behavior above, migrations are idempotent, Local/Neon switching is documented and scripted, Admin and Candidate views follow Ferio, and remaining external/integration gaps are explicitly marked in `IMPLEMENTATION_CHECKLIST.md` rather than described as complete.

## 19. Architecture migration verification

The existing single-process application remains the current runtime while the
replacement NestJS API (`backend/`) and Next.js UI (`frontend/`) are developed.
Migration status and cutover gaps are tracked in
`docs/ARCHITECTURE_MIGRATION_STATUS.md`; legacy feature completion does not imply
replacement-application parity.

The replacement API must reject malformed candidate session cookies with HTTP
401 and accept only the expected three-field signed token format. Initial
regression coverage uses isolated database mocks plus a disposable PostgreSQL
runner with synthetic accounts. Candidate portal endpoints must enforce the
initial password change with HTTP 403 while leaving identity, password change,
and logout available. Company browse limits are integers from 1 to 100.

Pipeline updates must allow clearing notes, refresh the modification timestamp,
and preserve the legacy date/count rules: Applied defaults to today's date
(UTC in the tested database configuration), omitted dates on other states retain
the previous date, and omitted reapply counts reset to zero. Core candidate API
persistence and isolation are verified locally; broader feature parity and browser
verification remain required before cutover.
