# Pipeline, Concurrency & Dataflow Architecture

This document details the **Dataflow Pipeline, Concurrency Guarantees, and Hybrid Matching Engine** of the Job Intelligence platform, covering concurrency controls, memory safety, streaming decompression, and deterministic scoring.

---

## ⚡ Mermaid Pipeline & Concurrency Diagram

```mermaid
sequenceDiagram
    autonumber
    box rgb(240, 244, 248) Client / Worker Trigger
        participant Trigger as Candidate UI / Scheduler CLI
    end
    box rgb(245, 245, 245) Concurrency & Quota Layer
        participant PG_Lock as PostgreSQL Advisory Lock (pg_advisory_xact_lock)
        participant Quota as Quota & Shortlist Service
    end
    box rgb(238, 242, 255) Resilient Web Crawling
        participant Fetcher as CareerPageFetcherService (DNS Pinning + Decompress)
        participant Extractor as CareerPageParser (Cheerio + SHA-256 Hasher)
        participant Ingest as CrawlIngestionService (Prisma Atomic Transaction)
    end
    box rgb(254, 243, 199) Hybrid Recommendation Engine
        participant Matcher as CandidateRecommendationsService (Bounded 1000-Job Scan)
        participant AI as AiMatchEnhancerService (15s Abort Timeout)
    end
    box rgb(236, 253, 245) Deduplicated Delivery
        participant Notif as DailyNotificationService (Deduplication + SMTP)
    end

    %% PHASE 1: Trigger & Advisory Lock
    Note over Trigger, PG_Lock: Phase 1: Concurrency Control & Atomic Quota Reservation
    Trigger->>PG_Lock: Begin Transaction & Acquire Advisory Lock
    activate PG_Lock
    PG_Lock->>Quota: Verify Daily Quota (Asia/Dhaka Day Bounds)
    alt Quota Exceeded (e.g. >3 searches/day)
        Quota-->>Trigger: HTTP 429 Too Many Requests
    else Quota Available
        Quota->>PG_Lock: Record Candidate Reservation
        PG_Lock-->>Quota: Quota Reserved & Lock Released
    end
    deactivate PG_Lock

    %% PHASE 2: Bounded Crawling & Ingestion
    Note over Fetcher, Ingest: Phase 2: Bounded Transport & Atomic Upsert
    Quota->>Fetcher: Fetch Company Career URL
    activate Fetcher
    Fetcher->>Fetcher: 1. Single-hop DNS Pinning (Anti-SSRF)<br/>2. Manual Redirects (Max 3, No HTTPS Downgrade)<br/>3. Streaming Decompression (Gzip / Deflate / Brotli)<br/>4. Hard Body Boundary (Strict 2 MiB Cap)
    Fetcher-->>Extractor: Raw HTML Stream (<2 MiB)
    deactivate Fetcher

    activate Extractor
    Extractor->>Extractor: Cheerio Extraction + Job Date/Deadline Normalization
    Extractor->>Extractor: Generate Stable Deterministic Job Hash (SHA-256)
    Extractor-->>Ingest: Normalized Vacancy DTOs
    deactivate Extractor

    activate Ingest
    Ingest->>Ingest: Open Prisma Transaction:
    Ingest->>Ingest: 1. Upsert Jobs (Set OPEN or refresh last_seen_at)<br/>2. Mark Expired Deadlines as CLOSED<br/>3. Record CrawlLog with Status & Duration
    Ingest-->>Matcher: Jobs Ingested & Persisted
    deactivate Ingest

    %% PHASE 3: Hybrid Recommendation Matching
    Note over Matcher, AI: Phase 3: Multi-Factor Deterministic & AI Semantic Matching
    activate Matcher
    Matcher->>Matcher: 1. Keyset Scan OPEN Jobs (Capped at 1,000)<br/>2. Hard Filter: Location Exclusion & Sector Filter<br/>3. Deterministic Multi-Factor Scoring (0–100):<br/>   • Job Family & Skill Aliases<br/>   • Controlled Experience & Numeric Years<br/>   • Work Mode & Location Preference<br/>   • Company Category Bonus
    
    alt Optional AI Mode Enabled & Budget Available
        Matcher->>AI: POST Semantic Analysis (Candidate Profile + Job Context)
        activate AI
        Note over AI: 15s Timeout Budget<br/>Max 15 calls / run
        alt LLM Provider Success (OpenAI)
            AI-->>Matcher: Semantic Score & AI Reasoning Explanation
            Matcher->>Matcher: Blend Score: round(Deterministic * 0.8 + Semantic * 0.2)
        else LLM Provider Failure / Timeout
            AI-->>Matcher: Fallback to Pure Deterministic Score
        end
        deactivate AI
    end
    Matcher-->>Trigger: Return Top Ranked Matches with Action Links
    deactivate Matcher

    %% PHASE 4: Deduplicated Notification Broadcast
    Note over Notif: Phase 4: Delivery Deduplication & SMTP Digest
    Trigger->>Notif: Trigger Daily Digest Broadcast
    activate Notif
    Notif->>Notif: Query Existing Notified Pairs from `notifications` Table
    Notif->>Notif: Filter Out Already-Notified Job IDs & Blacklisted Companies
    Notif->>Notif: Render Sanitized Ferio HTML/Text Digest
    Notif->>Notif: Dispatch via Nodemailer SMTP Transport
    Notif->>Notif: Record Sent Pairs in PostgreSQL (skipDuplicates: true)
    Notif-->>Trigger: Broadcast Complete (0 Duplicate Deliveries)
    deactivate Notif
```

---

## 🎯 Critical Failure Modes & Engineering Solutions

### 1. The Race Condition on Quotas & Daily Sweeps
* **Problem:** If a user opens multiple tabs and triggers Quick Search simultaneously, an uncoordinated count query reads 0 searches in all concurrent threads, allowing them to exceed their daily allowance.
* **Solution:** Used PostgreSQL `pg_advisory_xact_lock(candidate_id)`. The lock is automatically acquired and released within the transaction, guaranteeing strictly serialized quota increments without table-level locking bottlenecks.

### 2. Decompression Bombs & Network Anti-Bot Traps
* **Problem:** Many modern corporate sites enforce Gzip/Brotli compression, or they could return infinite HTTP streams / oversized files designed to exhaust scraper resources.
* **Solution:** 
  - Integrated `node:zlib` streaming decompression (`createUnzip`, `createBrotliDecompress`).
  - Implemented strict 2 MiB byte-counting stream transforms: if an uncompressed payload exceeds 2 MiB, the stream is aborted immediately with a sanitized `RESPONSE_TOO_LARGE` error.
  - DNS resolution is pinned to avoid DNS rebinding and internal subnet access (anti-SSRF).

### 3. Preventing Event-Loop Starvation in Matching
* **Problem:** Running in-memory regex matchers over tens of thousands of raw database vacancies will block Node.js's single-threaded event loop and exhaust memory.
* **Solution:** Configured a bounded keyset pagination with `MAX_MATCH_SCAN_JOBS = 1000`. Jobs older than 30 days unverified on the target career site are ignored, and expired deadlines are filtered at query time.

### 4. Zero-Flake AI Degradation
* **Problem:** External LLM APIs suffer from latency spikes, rate limits, and outages. Relying solely on AI for job matching breaks the core product whenever external providers are slow or down.
* **Solution:** AI is an optional 20% semantic blend on top of an 80% deterministic baseline. If the LLM provider times out (>15s) or returns invalid JSON, the system cleanly degrades to 100% deterministic ranking with zero user-facing errors.
