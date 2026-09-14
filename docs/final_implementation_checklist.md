# Implementation checklist

Legend: **[x] Done**, **[~] Implemented but external/runtime validation remains**, **[ ] Pending / not in MVP**.

This checklist is intentionally conservative. A feature that exists in source code but still needs real external credentials or broad production validation is marked `[~]`, not `[x]`.

## Product foundation

- [x] One Node.js application serves separate Admin and Candidate views.
- [x] PostgreSQL persistence layer.
- [x] Neon-compatible PostgreSQL connection through `DATABASE_URL`.
- [x] Local Docker PostgreSQL mode.
- [x] Explicit Local <-> Neon switching scripts and documentation.
- [x] Active database mode shown in Admin and `/health`.
- [x] Ferio shared design system in `src/ui/ferio.ts`.
- [x] Responsive/mobile-safe Admin and Candidate layouts.
- [x] Live secrets excluded from packaged source by policy/configuration.

## Dataset and companies

- [x] Curated company dataset imported into normalized `companies` table.
- [x] Duplicate research rows consolidated into company entities.
- [x] Source research notes/URLs preserved.
- [x] Company status/recommended action supported.
- [x] NHPF normalized as `No Hiring Page Found`, not a category.
- [x] NHPF excluded from normal monitor-ready crawling.
- [x] Multi-category company model (`categories`, `company_categories`).
- [x] Technology/domain/sector/other category types.
- [x] Admin can filter/edit company categories.
- [x] Deterministic category enrichment command.
- [~] Broad web/AI enrichment of all `Other` companies is incomplete by design; ambiguous companies remain `Other`.

## Crawler and jobs

- [x] Fetch + Cheerio generic crawler.
- [x] Source override mechanism.
- [x] Daily crawler script.
- [x] Crawl logs table/repository/admin page.
- [x] Stable job hashes and idempotent upsert.
- [x] Explicit no-opening handling.
- [x] Deadline/expired listing handling in generic extraction.
- [x] Daily schedule defaults to approximately 06:15 Asia/Dhaka.
- [x] Docker scheduler included.
- [x] GitHub Actions daily workflow included.
- [~] Full live validation across all monitor-ready company sites is not complete; per-site exceptions will continue to appear.
- [~] Anti-bot/JS-heavy sites may need adapters or remain disabled; bypassing protections is out of scope.
- [x] Jobs are not auto-closed after one missing crawl.
- [x] Verified seed SQL cleaned to avoid the earlier unverified Genex bulk set.

## Categories and matching

- [x] Deterministic matching works with AI off.
- [x] Expertise/job-family scoring.
- [x] Skill scoring and aliases.
- [x] Location preference scoring.
- [x] Excluded location hard rejection.
- [x] Experience scoring.
- [x] Work-mode handling.
- [x] Preferred/excluded candidate categories.
- [x] Sector exclusion hard filter.
- [x] Technology/domain exclusion applies only when the job matches it.
- [x] Company-category contextual bonus is capped.
- [x] `Other` category does not create a positive match signal.
- [x] Category phrase/word-boundary matching avoids short-label false positives such as `AI` inside unrelated words.

## AI

- [x] AI can be globally enabled/disabled through settings.
- [x] AI matching can be independently enabled/disabled.
- [x] AI daily call limit setting.
- [x] OpenAI-compatible provider interface.
- [x] AI errors fall back to deterministic matching.
- [x] Hard exclusions cannot be overridden by AI.
- [~] End-to-end AI provider call needs an actual configured provider/key/model.

## Candidate accounts and profile

- [x] Admin can create/update candidates.
- [x] Default candidate password configurable; current product default is `asdfasdf`.
- [x] Default password is hashed with `scrypt`, not stored plaintext.
- [x] Candidate must change the default password after first login.
- [x] Candidate email/password login.
- [x] Signed expiring candidate session cookie.
- [x] Candidate password-change screen.
- [x] Candidate self-service profile editing.
- [x] Candidate email remains read-only in self-service profile.
- [x] Skills, expertise, experience, locations, work modes, category preferences, exclusions, threshold supported.
- [~] Google OAuth flow implemented; requires real Google client credentials and redirect configuration to validate end-to-end.
- [x] No open public candidate registration.

## Candidate recommendations and pipeline

- [x] Candidate dashboard shows current ranked recommendations.
- [x] Recommendation explanations/context.
- [x] Apply link action.
- [x] Planning state.
- [x] Applied state.
- [x] Blacklist state (`EXCLUDED` internally).
- [x] Latest application date.
- [x] Re-apply count.
- [x] Candidate notes per company.
- [x] Blacklisted companies suppressed from recommendations.
- [x] Pipeline filters/list.

## Quick Job Search

- [x] Candidate Standard Quick Search.
- [x] Candidate AI-assisted Quick Search option.
- [x] Persistent per-candidate usage records.
- [x] Default limit: 3 quick searches/day.
- [x] Default limit: 1 AI quick search/day.
- [x] Default maximum: 8 relevant companies per quick search.
- [x] Admin can change Quick Search limits.
- [x] Candidate dashboard shows remaining usage.
- [x] Quick Search prefers relevant companies rather than crawling every monitor-ready company.
- [x] Quick Search results have Apply/Plan/Applied/Blacklist actions.

## Email/notifications

- [x] SMTP transport implementation.
- [x] Candidate digest renderer.
- [x] Daily notification command.
- [x] Notification deduplication table/logic.
- [x] Email can be disabled without breaking the application.
- [~] Real SMTP delivery requires provider credentials and an end-to-end delivery test.

## Admin operations

- [x] Dashboard.
- [x] Companies list/detail/edit.
- [x] Category management.
- [x] Jobs view.
- [x] Candidate management.
- [x] Crawler logs/status view.
- [x] Settings view.
- [x] Quick Search limit controls.
- [x] AI controls.
- [x] Email enable/disable setting.
- [x] Separate Admin authentication from Candidate authentication.
- [~] Admin currently uses HTTP Basic Auth. Suitable for localhost/private MVP; public deployment should sit behind HTTPS and may later move to a stronger admin auth flow.

## Ferio design compliance

- [x] Grayscale-first palette.
- [x] Semantic color reserved for statuses/actions.
- [x] Black primary pill buttons.
- [x] Hairline dividers instead of decorative card shadows.
- [x] No gradients/glassmorphism/decorative shadows.
- [x] Neutral grotesk/system font stack.
- [x] Restrained radii/spacing.
- [x] Operational tables avoid zebra striping.
- [x] Direct UI copy.
- [x] Mobile layout rules present.
- [~] Browser-by-browser visual QA on physical/mobile devices remains a deployment QA task.

## Docker and database portability

- [x] Dockerfile.
- [x] Local Compose stack: app + PostgreSQL + scheduler.
- [x] Neon Compose stack: app + scheduler using external Neon.
- [x] Named volume preserves local PostgreSQL data.
- [x] Idempotent startup bootstrap.
- [x] Empty local DB gets company/category seed data.
- [x] Start/stop scripts for Windows and macOS/Linux.
- [x] `switch-db` scripts for Local/Neon.
- [x] `npm run db:status` reports current target/counts without printing credentials.
- [x] `/health` checks DB connection and reports configured database mode.
- [x] Local and Neon Compose stacks share the same project name to prevent accidental parallel app stacks.
- [x] Documentation states switching does not synchronize data.
- [~] Docker configuration is statically validated; actual container runtime validation could not be performed in the ChatGPT build environment because Docker is unavailable there.
- [ ] Automatic Local <-> Neon data synchronization is intentionally out of MVP scope.

## Security and secrets

- [x] `.env` gitignored.
- [x] `.env` dockerignored from image build context.
- [x] No live Neon credential intentionally included in distributable project.
- [x] Candidate passwords hashed.
- [x] Signed expiring sessions.
- [x] Google account binding limited to existing active candidate email.
- [x] SQL writes use parameters in candidate/auth/application paths reviewed for this MVP.
- [~] Production HTTPS/reverse-proxy configuration is deployment-specific and not bundled as a managed hosting solution.
- [~] The previously exposed Neon password should be rotated by the database owner before public deployment.

## Verification and production readiness

- [x] SQL migrations/bootstrap designed to be idempotent where required for container startup.
- [x] Health endpoint.
- [x] Environment validation command.
- [x] Database-status command.
- [~] Full `npm install && npm run typecheck`/runtime test depends on a network-enabled environment with dependencies installed.
- [~] Full browser end-to-end test remains to be run after Docker starts on the target machine.
- [~] Real daily crawler run should be observed on the deployed network before calling crawler coverage production-stable.
- [~] Real SMTP test needed if email is enabled.
- [~] Real Google OAuth test needed if Google login is enabled.
- [~] Real AI provider test needed if AI mode is enabled.
- [ ] Public hosting/domain/TLS deployment is not performed by this repository itself.

## PRD governance

- [x] `PRD.md` is the source of truth for product requirements.
- [x] `IMPLEMENTATION_CHECKLIST.md` records implementation status without hiding partial/unverified work.
- [x] `docs/DATABASE_SWITCHING.md` is the source of truth for database-mode operations.
- [x] `npm run prd:audit` provides a structural guard against PRD/code drift.
- [x] README links to PRD, checklist, and database switching guide.
- [x] New feature work should update both PRD and checklist when behavior or scope changes.
