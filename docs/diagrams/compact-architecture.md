# Compact System Architecture

This document provides a streamlined, horizontal high-level architectural view of the Job Intelligence platform, highlighting core components, gateway security, and persistence topologies.

---

## 📄 Compact Architecture Diagram

```mermaid
flowchart LR
    %% Styling
    classDef client fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#0f172a;
    classDef gateway fill:#f1f5f9,stroke:#0284c7,stroke-width:1.5px,color:#0c4a6e;
    classDef core fill:#ffffff,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a;
    classDef storage fill:#f8fafc,stroke:#10b981,stroke-width:1.5px,color:#064e3b;
    classDef external fill:#fffbeb,stroke:#f59e0b,stroke-width:1.5px,color:#78350f;

    subgraph CLIENT["Client Layer"]
        NEXT["Next.js 15 Standalone<br/>- Candidate Portal<br/>- Admin Operations"]:::client
    end

    subgraph SECURITY["Security & Gateway"]
        GW["NestJS API Gateway<br/>- Redis Sliding-Window Rate Limit<br/>- Versioned Session Revocation<br/>- BigInt Serializer Interceptor"]:::gateway
    end

    subgraph ENGINE["Core Application Engine (NestJS 11)"]
        direction TB
        CRAWL["Bounded Web Crawler<br/>- DNS Pinning (Anti-SSRF)<br/>- Gzip/Brotli Decompression<br/>- SHA-256 Job Hasher"]:::core
        MATCH["Hybrid Match Engine<br/>- Deterministic (Skills/Exp/Location)<br/>- Optional LLM Semantic Rerank<br/>- Bounded Keyset Scan (1K)"]:::core
        WORKER["CLI / Cron Schedulers<br/>- Keyset Sweep: pnpm crawl:daily<br/>- Deduplicated SMTP Broadcast"]:::core
    end

    subgraph DATA["Persistence & Concurrency"]
        direction TB
        PG[("PostgreSQL 16 / Neon<br/>- Prisma 7 + Pooled Adapter<br/>- Advisory Locks (Quota & Sweeps)")]:::storage
        REDIS[("Redis 7 Alpine<br/>- Sliding-Window ZSETs")]:::storage
    end

    subgraph EXT["External Ecosystem"]
        direction TB
        WEB["Target Career Sites"]:::external
        AI["OpenAI LLM API"]:::external
        MAIL["SMTP Mail Service"]:::external
    end

    NEXT -->|"HTTPS / Signed Cookies"| GW
    GW --> CRAWL
    GW --> MATCH
    GW --> WORKER

    GW <-->|"Atomic Pipelines"| REDIS
    MATCH <-->|"Advisory Locks & Queries"| PG
    CRAWL <-->|"Atomic Ingestion"| PG
    WORKER <-->|"Deduplication & Sweeps"| PG

    CRAWL -->|"Streaming 2MB Limit"| WEB
    MATCH -.->|"15s Timeout Budget"| AI
    WORKER -->|"Sanitized HTML Digests"| MAIL
```

---

## 📝 Core Architectural Highlights

- **Full-Stack Modular Architecture:** Engineered a high-throughput job crawling and candidate matching platform using **NestJS 11**, **Next.js 15 Standalone**, **PostgreSQL 16 (Neon)**, and **Redis 7**, fully verified across a **5-layer automated testing pyramid (198 tests: Unit, Integration, DB, E2E, Playwright)** with a 100% pass rate.
- **High-Throughput Concurrency & Rate Limiting:** Implemented sliding-window rate limiting in Redis via atomic Sorted Set pipelines (`multi()`, `zremrangebyscore`) and eliminated race conditions on candidate quotas using PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock`).
- **Resilient Bounded Web Crawler:** Built a memory-safe HTTP crawler featuring single-hop DNS pinning (anti-SSRF), manual redirect tracing, streaming Brotli/Gzip decompression with strict 2 MiB memory boundaries, and SHA-256 idempotent vacancy deduplication.
- **Fault-Tolerant Hybrid Matcher:** Designed a multi-factor deterministic matching engine (experience years, skills, locations, work modes) blended with optional LLM semantic scoring (80/20 ratio), featuring automated fallback to pure deterministic scoring upon external API timeouts (<15s).
- **Zero-Downtime Session & Database Hardening:** Designed token-versioned candidate authentication with instant session revocation, eliminated native BigInt serialization crashes via a global NestJS interceptor, and dynamically tuned database connection pools for serverless Neon.
