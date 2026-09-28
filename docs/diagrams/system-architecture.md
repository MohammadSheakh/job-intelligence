# System Architecture Specification

This document details the **System Architecture (C4 Container & Component View)** for the Job Intelligence platform, covering separation of concerns, cross-cutting security, background workers, and distributed data stores.

---

## 🏗️ Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["Client Layer - Next.js 15 Standalone"]
        direction LR
        CP["Candidate Portal (/candidate/*)<br/>Self-Service Profile & Pipeline<br/>Standard & AI Quick Search"]
        AP["Admin Operations Console (/admin/*)<br/>Company Intelligence & Jobs<br/>Candidate Mgmt & Telemetry"]
    end

    subgraph Security["Cross-Cutting Security & Gateway - NestJS"]
        direction TB
        RL["Redis Sliding-Window Rate Limiter<br/>SlidingWindowRateLimitGuard<br/>Atomic ZSET: 10-60 req/min"]
        AUTH["Authentication & Authorization<br/>Candidate: Versioned Session Token<br/>Admin: Timing-Safe Basic Auth"]
        INTERCEPT["Global Interceptors & Filters<br/>BigIntSerializerInterceptor<br/>GlobalHttpExceptionFilter"]
    end

    subgraph Services["Core Application Services - NestJS"]
        direction TB
        AUTH_M["Authentication Module<br/>Scrypt Hashing / Google OAuth / Session Revocation"]
        CAND_M["Candidate Portal Module<br/>Profile / Application Pipeline / Directory"]
        COMP_M["Company Intelligence Module<br/>Category Taxonomy / Review Queue / Enrichment"]
        CRAWL_M["Job Crawling Module<br/>Bounded Fetcher / Streaming Decompression / Cheerio Parser"]
        SEARCH_M["Quick Search Module<br/>Advisory Lock Quota / Candidate Search Runs"]
        MATCH_M["Matching Engine Module<br/>Bounded 1000-Job Scan / Multi-Factor Deterministic"]
        NOTIF_M["Notification Module<br/>Ferio Digest Renderer / Deduplication Service"]
        ADMIN_M["Admin Operations Module<br/>Operations Dashboard / System Settings"]
    end

    subgraph Workers["Background CLI & Workers"]
        direction LR
        SCHED["Docker Scheduler Daemon<br/>Cron: 06:15 Asia/Dhaka"]
        CRAWL_CLI["Daily Crawler CLI<br/>pnpm crawl:daily"]
        NOTIF_CLI["Daily Notifier CLI<br/>pnpm notify:daily"]
        SCHED --> CRAWL_CLI
        SCHED --> NOTIF_CLI
    end

    subgraph Data["Persistence & Caching Infrastructure"]
        direction LR
        PG[("PostgreSQL 16 / Neon<br/>Prisma 7 + Adapter-pg<br/>Dynamic Pool: 10-20<br/>pg_advisory_xact_lock")]
        REDIS[("Redis 7 Alpine<br/>Sliding-Window Sorted Sets<br/>TTL Auto-Eviction")]
    end

    subgraph External["External Services"]
        direction LR
        SITES["Target Career Sites<br/>Public HTTPS / HTML"]
        LLM["OpenAI LLM API<br/>Semantic Match Scoring"]
        SMTP["SMTP Mail Provider<br/>Candidate Digest Delivery"]
        GOOG["Google Identity API<br/>OAuth Account Binding"]
    end

    %% Inbound Client Requests
    CP -->|"HTTPS / Signed Cookie"| RL
    AP -->|"HTTPS / Basic Auth"| RL

    %% Security Gateway Flow
    RL --> AUTH
    AUTH --> INTERCEPT

    %% Gateway to Feature Modules
    INTERCEPT --> AUTH_M
    INTERCEPT --> CAND_M
    INTERCEPT --> COMP_M
    INTERCEPT --> SEARCH_M
    INTERCEPT --> ADMIN_M

    %% Inter-module coordination
    SEARCH_M --> CRAWL_M
    SEARCH_M --> MATCH_M
    CRAWL_CLI --> CRAWL_M
    NOTIF_CLI --> NOTIF_M
    NOTIF_M --> MATCH_M

    %% Data & Infrastructure Access
    RL <-->|"Atomic ZSET Pipelines"| REDIS
    AUTH_M <-->|"Connection Pool"| PG
    CAND_M <-->|"Connection Pool"| PG
    COMP_M <-->|"Connection Pool"| PG
    CRAWL_M <-->|"Atomic Upsert & Logs"| PG
    SEARCH_M <-->|"pg_advisory_xact_lock"| PG
    MATCH_M <-->|"Keyset Scan"| PG
    ADMIN_M <-->|"Connection Pool"| PG
    NOTIF_M <-->|"Deduplication Query"| PG

    %% External Integrations
    CRAWL_M -->|"DNS Pinning & 2MB Stream"| SITES
    MATCH_M -.->|"Optional Semantic Rerank - 15s Timeout"| LLM
    NOTIF_M -->|"Sanitized HTML Digest"| SMTP
    AUTH_M -->|"Token Exchange"| GOOG
```

---

## 💡 Key Architectural Design Decisions

1. **Enterprise Boundary Decoupling:**
   - Next.js 15 standalone frontend communicating strictly over typed REST APIs (`/api/v1/*`) to NestJS.
   - Dual-portal isolation: Candidates use signed, expiring, versioned HTTP-only cookie sessions; Administrators use timing-safe HTTP Basic Auth.
2. **Industrial Cross-Cutting Defenses:**
   - **Redis Sliding-Window Rate Limiting:** Built using atomic Redis Sorted Set pipelines (`multi()`, `zremrangebyscore`, `zadd`, `zcard`, `expire`) with standard RFC headers (`X-RateLimit-*`, `Retry-After`).
   - **Global BigInt Serializer Interceptor:** Eliminates native Node.js BigInt serialization crashes across all PostgreSQL bigint IDs.
   - **Sanitized Global Error Envelope:** Unhandled database exceptions or internal stack traces are cleanly caught and normalized, never leaking schema internals.
3. **Concurrency & Locking Control:**
   - Concurrency-safe quota reservation using PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock`) ensuring candidates cannot bypass search limits via parallel requests.
   - Dedicated session advisory lock prevents overlapping daily crawler instances.
4. **Resilient Crawler Transport:**
   - Anti-SSRF protection: single-hop DNS resolution with pinned public IPs and manual redirect validation (no HTTPS-to-HTTP downgrade).
   - Streaming Brotli/Gzip/Deflate decompression with strict 2 MiB boundary safety to prevent compression bomb attacks.
5. **Hybrid Matcher Architecture:**
   - 100% operational with AI disabled: multi-factor deterministic scoring (skills, expertise, experience years, locations, work modes, and hard sector/location exclusions).
   - Optional LLM integration: blends deterministic score (80%) with semantic score (20%) with a strict 15-second abort controller and automatic deterministic fallback.
