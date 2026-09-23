# Operator Guide: Running Job Intelligence (Backend & Frontend)

This guide provides the complete set of commands, configuration instructions, and operational procedures for running the **Job Intelligence** application in production, staging, and containerized environments.

---

## Table of Contents
1. [Architecture & Port Allocation](#1-architecture--port-allocation)
2. [Prerequisites & Host Requirements](#2-prerequisites--host-requirements)
3. [Environment Configuration Reference](#3-environment-configuration-reference)
4. [Deployment Mode A: Docker Compose with Neon DB (Production Recommended)](#4-deployment-mode-a-docker-compose-with-neon-db-production-recommended)
5. [Deployment Mode B: Docker Compose Full Local Stack (Self-Contained)](#5-deployment-mode-b-docker-compose-full-local-stack-self-contained)
6. [Deployment Mode C: Host Bare-Metal / VM Execution](#6-deployment-mode-c-host-bare-metal--vm-execution)
7. [Running Background Schedulers & CLI Tasks](#7-running-background-schedulers--cli-tasks)
8. [Health Checks & Verification Procedures](#8-health-checks--verification-procedures)
9. [Operational Maintenance & Database Migrations](#9-operational-maintenance--database-migrations)

---

## 1. Architecture & Port Allocation

The system consists of 4 primary decoupled services:

```text
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER CLIENTS                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     Port 3000 (HTTP)                Port 4000 (HTTP/JSON)
┌─────────────────────────────┐ ┌─────────────────────────────┐
│      Next.js Frontend       │ │      NestJS API Backend     │
│   (App Router, SSR, UI)     │ │  (Rate Limiting, Logic, DB) │
└─────────────────────────────┘ └──────────────┬──────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
               Port 6379 (TCP)                                 Port 5432 (TCP/SSL)
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│       Redis 7 Cache         │                 │    PostgreSQL / Neon DB     │
│  (Sliding-Window Limiter)   │                 │   (Authoritative Records)   │
└─────────────────────────────┘                 └─────────────────────────────┘
```

| Service | Container Name | Port (Host:Container) | Healthcheck |
| :--- | :--- | :--- | :--- |
| **Next.js Frontend** | `frontend` | `3000:3000` | HTTP GET `/` (returns 200) |
| **NestJS Backend** | `backend` | `4000:4000` | HTTP GET `/api/v1/admin/settings` (returns 401/200) |
| **Redis 7** | `redis` | `6379:6379` | `redis-cli ping` (returns PONG) |
| **Local PostgreSQL 16** | `db` *(Local compose only)* | `5432:5432` | `pg_isready -U jobapp -d job_intelligence` |
| **Scheduler Daemon** | `scheduler` | Internal | Controlled by backend health dependency |

---

## 2. Prerequisites & Host Requirements

- **Linux OS** (Ubuntu 22.04 LTS / Debian 12 or similar recommended)
- **Docker Engine**: `24.0+` with Docker Compose V2 (`docker compose version`)
- **Memory**: Minimum 2 GB RAM (4 GB recommended for building images)
- **Disk Space**: At least 10 GB free for Docker layers and cached images

---

## 3. Environment Configuration Reference

Create your production `.env` file in the repository root:

```bash
cp .env.example .env
chmod 600 .env
```

### Key Production Variables:

```env
# Database Configuration
DATABASE_URL=postgresql://<user>:<password>@<endpoint-id>.neon.tech/<dbname>?sslmode=require
DATABASE_MODE=neon
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_CONN_TIMEOUT_MS=5000

# Redis Rate Limiting
REDIS_URL=redis://redis:6379
RATE_LIMIT_FAIL_OPEN=false

# Security & Sessions
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-to-a-strong-admin-password
DEFAULT_CANDIDATE_PASSWORD=asdfasdf
CANDIDATE_SESSION_SECRET=generate-a-strong-random-64-character-hex-string
COOKIE_SECURE=true
FRONTEND_ORIGIN=https://your-domain.com

# Frontend API Endpoint
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
PORT=3000

# Background Scheduler
TZ=Asia/Dhaka
DAILY_CRAWL_HOUR=6
DAILY_CRAWL_MINUTE=15
RUN_DAILY_ON_START=false
```

---

## 4. Deployment Mode A: Docker Compose with Neon DB (Production Recommended)

This mode runs the optimized containerized frontend, backend, Redis 7 rate limiter, and background scheduler connected to your live **Neon PostgreSQL** database.

### 1. Validate Compose File Syntax
```bash
docker compose -f compose.neon.yaml config --quiet
```

### 2. Build and Start All Services
```bash
# Builds images with cached layers and starts containers detached
docker compose -f compose.neon.yaml up --build -d
```

### 3. Check Service Status & Health
```bash
docker compose -f compose.neon.yaml ps
```
*Verify that all services report `healthy` or `running`.*

### 4. Monitor Live Logs
```bash
# View combined logs:
docker compose -f compose.neon.yaml logs -f

# View specific service logs:
docker compose -f compose.neon.yaml logs -f backend
docker compose -f compose.neon.yaml logs -f frontend
docker compose -f compose.neon.yaml logs -f scheduler
```

### 5. Stop the Application
```bash
# Gracefully stop containers:
docker compose -f compose.neon.yaml stop

# Tear down containers (preserves Redis volume data):
docker compose -f compose.neon.yaml down
```

---

## 5. Deployment Mode B: Docker Compose Full Local Stack (Self-Contained)

This mode runs everything locally inside Docker, including local PostgreSQL 16, Redis 7, NestJS, Next.js, and the scheduler.

### 1. Start Full Local Stack
```bash
docker compose up --build -d
```

### 2. Check Service Status
```bash
docker compose ps
```

### 3. Stop Local Stack
```bash
docker compose down
```

> [!TIP]
> To reset the local database volume and start fresh:
> ```bash
> docker compose down -v
> ```

---

## 6. Deployment Mode C: Host Bare-Metal / VM Execution

If deploying directly onto a Linux VM or physical host with Node.js and PM2 / systemd:

### 1. Install Production Dependencies
```bash
pnpm install --frozen-lockfile
```

### 2. Build Production Bundles
```bash
# Build NestJS backend (generates dist/):
pnpm build:backend

# Build Next.js frontend (generates .next/):
pnpm build:frontend
```

### 3. Apply Production Database Migrations
```bash
pnpm prisma:migrate:deploy
```

### 4. Run Services on Host

#### Start Backend API (Port 4000)
```bash
NODE_ENV=production pnpm start:backend
# Or:
node backend/dist/src/main.js
```

#### Start Frontend UI (Port 3000)
```bash
NODE_ENV=production pnpm start:frontend
# Or:
pnpm --dir frontend start
```

#### Start In-Container / Host Scheduler
```bash
NODE_ENV=production node backend/scripts/docker-scheduler.mjs
```

---

## 7. Running Background Schedulers & CLI Tasks

### In-Container Scheduler Daemon
The `scheduler` container automatically starts [`backend/scripts/docker-scheduler.mjs`](file:///home/chillpc/MohammadSheakh/projects/26/job-intelligence-prd-db-switch-ready/job-intelligence-prd-db-switch/backend/scripts/docker-scheduler.mjs). It wakes at `06:15 Asia/Dhaka` every morning to execute the daily crawl and email notifications.

### Triggering Manual Sweeps On-Demand

#### Run Daily Job Crawl Manually
```bash
# Via host:
pnpm crawl:daily

# Via running Docker container:
docker compose -f compose.neon.yaml exec backend node dist/src/commands/crawl-daily.js
```

#### Run Candidate Notification Digest Manually
```bash
# Via host:
pnpm notify:daily

# Via running Docker container:
docker compose -f compose.neon.yaml exec backend node dist/src/commands/notify-daily.js
```

---

## 8. Health Checks & Verification Procedures

Verify that the system is operating normally:

### 1. API Health Check
```bash
curl -I http://127.0.0.1:4000/api/v1/health
# Expected: HTTP/1.1 200 OK
```

### 2. Admin Basic Auth Protection Probe
```bash
curl -I http://127.0.0.1:4000/api/v1/admin/settings
# Expected: HTTP/1.1 401 Unauthorized
```

### 3. Frontend Landing Gateway Probe
```bash
curl -I http://127.0.0.1:3000/
# Expected: HTTP/1.1 200 OK
```

### 4. Browser Smoke Test
Open your browser to:
- **Landing Gateway**: `http://localhost:3000/`
- **Candidate Workspace**: `http://localhost:3000/candidate/login`
  - *Login credentials*: Active candidate email + default password (`asdfasdf`).
- **Operations Console**: `http://localhost:3000/admin`
  - *Admin credentials*: HTTP Basic Auth (`admin` / `asdfasdf` or configured values).

---

## 9. Operational Maintenance & Database Migrations

### Checking Database Migration Status
```bash
pnpm prisma:migrate:status
```

### Deploying New Migrations in Production
```bash
pnpm prisma:migrate:deploy
```

### Non-Destructive Seed Bootstrap
```bash
pnpm prisma:seed --apply
```

### Inspecting Redis Rate Limit Keys
```bash
docker compose -f compose.neon.yaml exec redis redis-cli KEYS "ratelimit:*"
```

### Clearing Rate Limit Lockout (Operator Emergency)
```bash
docker compose -f compose.neon.yaml exec redis redis-cli FLUSHDB
```
