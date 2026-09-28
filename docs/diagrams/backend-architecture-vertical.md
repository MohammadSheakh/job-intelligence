# Backend Architecture (Vertical / PDF Optimized)

This document provides a **vertical, Y-axis-oriented backend architecture specification** of the Job Intelligence platform. 

It is specifically structured for **portrait documents, PDF exports, and print rendering**, avoiding horizontal (X-axis) sprawl while detailing the entire backend subsystem: HTTP ingress pipeline, controllers, NestJS feature modules, domain services, background CLI workers, shared libraries, persistence layer, and external integrations.

---

## 🏗️ Vertical Backend Architecture Diagram

```mermaid
flowchart TB
    %% TIER 1: Ingress & Security Pipeline
    subgraph TIER_INGRESS ["1. HTTP Ingress & Security Pipeline"]
        direction TB
        REQ["Client Requests: Candidate Portal & Admin Console (/api/v1/*)"]
        RL["Redis Sliding-Window Rate Limiter<br/>SlidingWindowRateLimitGuard (10–60 req/min via atomic ZSET)"]
        AUTH_G["Authentication & Session Guards<br/>CandidateSessionGuard (HMAC + Token Version) / AdminBasicAuthGuard"]
        PIPELINE["Global Interceptors & Error Filter<br/>BigIntSerializerInterceptor (BigInt to String) / GlobalHttpExceptionFilter"]
        
        REQ --> RL
        RL --> AUTH_G
        AUTH_G --> PIPELINE
    end

    %% TIER 2: API Controllers
    subgraph TIER_CTRL ["2. API Controllers Layer"]
        direction TB
        CAND_CTRL["Candidate Controllers<br/>CandidateAuthController / CandidateProfileController / CandidatePipelineController<br/>CandidateCompanyBrowseController / CandidateRecommendationsController / CandidateSearchUsageController"]
        ADMIN_CTRL["Admin Operations Controllers<br/>AdminDashboardController / AdminCompaniesController / AdminCategoriesController<br/>AdminJobsController / AdminCandidatesController / AdminCrawlLogsController / AdminSettingsController"]
    end
    PIPELINE --> CAND_CTRL
    PIPELINE --> ADMIN_CTRL

    %% TIER 3: Modular Feature Services
    subgraph TIER_SERVICES ["3. NestJS Feature Modules & Services Layer"]
        direction TB
        
        subgraph MOD_AUTH ["AuthenticationModule"]
            SVC_AUTH["CandidateAuthenticationService / CandidateSessionService / GoogleOAuthService<br/>• Scrypt password hashing with unique salt<br/>• 4-part HMAC signed tokens (id.version.expiry.signature)<br/>• Database-backed token_version for instant multi-device revocation<br/>• Google OAuth code exchange & verified email account binding"]
        end

        subgraph MOD_CAND ["CandidatePortalModule"]
            SVC_CAND["CandidateProfileService / CandidatePipelineService / CandidateCompanyBrowseService<br/>• Self-service profile editing & experience/skills normalization<br/>• Application pipeline state tracking: PLANNING / APPLIED / EXCLUDED (Blacklist)<br/>• Paginated active company research directory (25/page) independent of matching"]
        end

        subgraph MOD_SEARCH ["QuickSearchModule"]
            SVC_SEARCH["QuickSearchExecutionService / QuickSearchQuotaService / QuickSearchCompanySelectorService<br/>• Concurrency control via PostgreSQL transaction advisory lock: pg_advisory_xact_lock(candidate_id)<br/>• Daily quota enforcement calculated against Asia/Dhaka midnight boundaries<br/>• Bounded selection of top 25 active monitor-ready target companies (excluding blacklists)"]
        end

        subgraph MOD_MATCH ["MatchingModule (Zero-Mutation Engine)"]
            SVC_MATCH["CandidateRecommendationsService / AiMatchEnhancerService<br/>• Zero-mutation boundary: strictly read-only calculation engine (never writes to DB)<br/>• Multi-factor deterministic scoring (0–100): skills, job family, controlled experience, locations, work modes<br/>• Hard filters: sector exclusions & excluded location rejection win over positive scoring<br/>• Optional LLM semantic blending: round(deterministic * 0.8 + semantic * 0.2) with 15s abort timeout"]
        end

        subgraph MOD_CRAWL ["JobCrawlingModule & CrawlExecutionModule"]
            SVC_CRAWL["CareerPageFetcherService / CrawlIngestionService / CompanyCrawlService<br/>• Single-hop DNS resolution with public IP pinning (Anti-SSRF protection)<br/>• Manual redirect validation (max 3 hops, no HTTPS-to-HTTP downgrade)<br/>• Streaming Brotli / Gzip / Deflate decompression with strict 2 MiB boundary safety<br/>• Cheerio vacancy DOM extraction & SHA-256 idempotent job deduplication upsert"]
        end

        subgraph MOD_COMP ["CompanyIntelligenceModule"]
            SVC_COMP["AdminCompanyService / AdminCategoryService<br/>• Multi-category taxonomy management (technology, domain, sector, other)<br/>• Company manual review queue & review reason tracking<br/>• Official website inspection & career URL discovery enrichment"]
        end

        subgraph MOD_NOTIF ["NotificationsModule"]
            SVC_NOTIF["DailyNotificationService / NotificationDeduplicationService / EmailRenderService / EmailTransportService<br/>• Evaluates candidate threshold fit and filters out candidate company blacklists<br/>• Queries notifications table (getNotifiedPairSet) to prevent duplicate emails<br/>• Ferio-style HTML & plain-text digest rendering with URL sanitization<br/>• SMTP delivery via Nodemailer with atomic delivery record persistence"]
        end

        subgraph MOD_ADMIN ["AdminOperationsModule & SettingsModule"]
            SVC_ADMIN["AdminDashboardService / AdminCandidatesService / SettingsService<br/>• Aggregated operations telemetry: job counts, active candidates, 24h crawler failure rates<br/>• Candidate account administration, initial password assignment, and password resets<br/>• Dynamic runtime settings: AI switches, daily limits, threshold percentages, email toggle"]
        end

        %% Service to Service Internal Wiring
        CAND_CTRL --> MOD_AUTH
        CAND_CTRL --> MOD_CAND
        CAND_CTRL --> MOD_SEARCH
        ADMIN_CTRL --> MOD_COMP
        ADMIN_CTRL --> MOD_ADMIN

        MOD_CAND --> MOD_MATCH
        MOD_SEARCH --> MOD_CRAWL
        MOD_SEARCH --> MOD_MATCH
        MOD_NOTIF --> MOD_MATCH
        MOD_ADMIN --> MOD_COMP
        MOD_ADMIN --> MOD_CRAWL
    end

    %% TIER 4: CLI Workers & Scheduler
    subgraph TIER_WORKERS ["4. Background CLI Workers & Scheduler Layer"]
        direction TB
        SCHED["Docker Scheduler Daemon<br/>(Node.js process orchestrating schedules at 06:15 Asia/Dhaka)"]
        WORKER_CRAWL["Daily Crawler CLI: pnpm crawl:daily<br/>(CrawlWorkerModule: sweeps active companies in 50-row keyset batches with session advisory locks)"]
        WORKER_NOTIF["Daily Notifier CLI: pnpm notify:daily<br/>(NotifyWorkerModule: batch processes deduplicated candidate digests and dispatches via SMTP)"]
        
        SCHED --> WORKER_CRAWL
        SCHED --> WORKER_NOTIF
        WORKER_CRAWL --> MOD_CRAWL
        WORKER_NOTIF --> MOD_NOTIF
    end

    %% TIER 5: Infrastructure & Shared Libraries
    subgraph TIER_INFRA ["5. Shared Libraries & Persistence Layer"]
        direction TB
        LIB_DB[("PostgreSQL 16 / Serverless Neon (@app/database)<br/>• Prisma 7 Client with @prisma/adapter-pg<br/>• Dynamic connection pool: DATABASE_POOL_MAX (10–20 connections)<br/>• Concurrency primitives: pg_advisory_xact_lock<br/>• 11 normalized tables with legacy CHECK constraints")]
        LIB_REDIS[("Redis 7 Alpine (@app/redis)<br/>• ioredis client with RedisClientsLifecycle teardown<br/>• Sliding-window rate limit sorted sets (ZSET)<br/>• Atomic multi() pipelines: ZREMRANGEBYSCORE / ZADD / ZCARD / EXPIRE")]
    end
    TIER_SERVICES <-->|"Prisma Queries & Advisory Locks"| LIB_DB
    TIER_INGRESS <-->|"Atomic ZSET Pipelines"| LIB_REDIS

    %% TIER 6: External Integrations
    subgraph TIER_EXT ["6. External Boundary & Integrations"]
        direction TB
        EXT_SITES["Target Company Career Sites<br/>(Public HTTPS HTML pages, Cloudflare/CloudFront CDNs)"]
        EXT_LLM["OpenAI-Compatible LLM API<br/>(Semantic match score reranking with 15s timeout)"]
        EXT_SMTP["SMTP Mail Provider<br/>(Candidate notification digest transmission)"]
        EXT_GOOGLE["Google Identity API<br/>(OAuth code exchange & verified email lookup)"]
    end
    MOD_CRAWL -->|"Streaming Fetch (2 MiB Cap)"| EXT_SITES
    MOD_MATCH -.->|"Optional Semantic Call (15s Timeout)"| EXT_LLM
    MOD_NOTIF -->|"SMTP Digest Dispatch"| EXT_SMTP
    MOD_AUTH -->|"Token Exchange"| EXT_GOOGLE
```

---

## 📋 Architectural Layers Breakdown

### 1. Ingress & Security Pipeline Layer
- **Unified Route Prefix:** Every backend resource is scoped under `/api/v1/*`.
- **`SlidingWindowRateLimitGuard` (`@app/common`):** Enforces route-level sliding-window rate limits backed by Redis atomic Sorted Sets. Configured presets protect authentication (10 req/min), quick search execution (20 req/min), and admin mutations (60 req/min). Returns RFC-compliant `X-RateLimit-*` and `Retry-After` headers.
- **Session Security & Revocation:** Candidate authentication uses 4-part HMAC signed session tokens (`id.version.expiry.signature`). The `token_version` column in PostgreSQL enables instant invalidation of active sessions across all devices upon password reset or explicit logout.
- **Global Data Serialization & Error Envelope:**
  - `BigIntSerializerInterceptor`: Automatically serializes native PostgreSQL BigInt IDs to strings before JSON output, preventing runtime Node.js serialization exceptions.
  - `GlobalHttpExceptionFilter`: Intercepts unhandled exceptions and formats consistent `{ code, message, timestamp, path }` error envelopes, ensuring database stack traces and query structures are never leaked.

### 2. API Controllers Layer
- **Separation of Concerns:** Clear segregation between Candidate Portal endpoints (`/api/v1/candidate/*`, `/api/v1/candidate-auth/*`) and Admin Operations endpoints (`/api/v1/admin/*`).
- **Authorization Guarding:** Admin endpoints are guarded by timing-safe HTTP Basic Authentication; candidate routes require active session cookies and mandatory initial password change completion.

### 3. NestJS Feature Modules & Services Layer
- **`AuthenticationModule`:** Manages salted Scrypt password hashing, Google OAuth code-to-token exchange, session token issuance/validation, and multi-session revocation.
- **`CandidatePortalModule`:** Powers candidate profile preferences, category exclusions, research company directory browsing, and candidate application pipeline status (`PLANNING`, `APPLIED`, `EXCLUDED`).
- **`QuickSearchModule`:** Coordinates on-demand candidate job checks. Acquires a PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock(candidate_id)`) to enforce daily search limits atomically, selects up to 25 target companies, triggers paced crawler checks, and computes fresh match scores.
- **`MatchingModule` (Zero-Mutation Engine):** A strictly read-only calculation engine with zero database write paths. Evaluates multi-factor deterministic scoring (0–100) combining skills, job families, controlled experience levels, numeric years, and locations while strictly applying hard exclusions. Provides an optional LLM semantic blending path (`80% deterministic + 20% semantic`) with a 15-second abort timeout budget.
- **`JobCrawlingModule` & `CrawlExecutionModule`:** Network-safe web crawling pipeline featuring single-hop DNS resolution with public IP pinning (Anti-SSRF), manual redirect tracing (maximum 3 hops), streaming Brotli/Gzip decompression with a strict 2 MiB memory boundary, Cheerio vacancy extraction, SHA-256 stable job hashing, and atomic database upserts.
- **`CompanyIntelligenceModule`:** Manages curated companies, multi-category taxonomy (technology, domain, sector, other), manual review queues, and career page URL discovery enrichment.
- **`NotificationsModule`:** Orchestrates daily candidate email broadcasts. Evaluates candidate thresholds, filters blacklists, deduplicates delivery records via the `notifications` table, renders Ferio-style responsive HTML/text digests, and dispatches via SMTP.
- **`AdminOperationsModule` & `SettingsModule`:** Aggregates operational telemetry, provides candidate management and password reset operations, and manages persisted runtime system settings.

### 4. Background CLI Workers & Scheduler Layer
- **`Docker Scheduler Daemon`:** Minimal Node.js daemon running inside the container, executing daily jobs on cron schedules (default: 06:15 Asia/Dhaka).
- **`Daily Crawler CLI` (`pnpm crawl:daily`):** Standalone worker sweeping active monitor-ready companies in 50-row keyset batches, using direct PostgreSQL session advisory locks to prevent overlapping crawl executions.
- **`Daily Notifier CLI` (`pnpm notify:daily`):** Standalone worker evaluating candidate match recommendations and transmitting deduplicated daily digests via SMTP.

### 5. Shared Libraries & Persistence Infrastructure
- **`@app/database` (`PrismaService`):** PostgreSQL 16 / Neon connection management using `@prisma/adapter-pg` with dynamic pool configuration (`DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONN_TIMEOUT_MS`) and clean connection pool draining via NestJS shutdown hooks.
- **`@app/redis` (`RedisProvider` & `RedisClientsLifecycle`):** Dedicated Redis 7 client handling atomic sliding-window rate limit pipelines and automated client teardown on application shutdown.

### 6. External Boundary & Integrations
- **Company Career Sites:** Public HTTPS career pages fetched with strict streaming size caps (2 MiB).
- **OpenAI-Compatible LLM:** External semantic evaluation API called with strict 15-second timeouts and automatic fallback to deterministic scoring.
- **SMTP Server:** Secure email delivery provider for candidate job digests.
- **Google Identity API:** OpenID Connect endpoints for candidate Google login verification.
