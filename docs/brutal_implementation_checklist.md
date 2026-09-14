# Implementation Checklist

## Phase 1 — Review Existing Data

* [ ] Inspect XLSX.
* [ ] Inspect CSV.
* [ ] Confirm which columns exist.
* [ ] Remove obvious duplicates.
* [ ] Standardize company names.
* [ ] Standardize website URLs.
* [ ] Standardize career URLs.
* [ ] Standardize LinkedIn URLs.
* [ ] Standardize locations.
* [ ] Standardize tech-stack values.
* [ ] Decide final company columns.

Deliverable:

```text
clean company-data structure
```

---

# Phase 2 — Create Project

* [ ] Create GitHub repository.
* [ ] Initialize TypeScript.
* [ ] Create Next.js application.
* [ ] Configure environment variables.
* [ ] Configure Supabase/PostgreSQL.
* [ ] Configure basic testing.

---

# Phase 3 — Database

Create:

```text
companies
jobs
candidates
notifications
settings
```

Optionally:

```text
crawl_logs
```

Do not create additional tables until necessary.

---

# Phase 4 — Company Import

* [ ] Create XLSX/CSV import script.
* [ ] Map old columns to new fields.
* [ ] Validate URLs.
* [ ] Import companies.
* [ ] Check duplicate companies.

---

# Phase 5 — Company Management

Admin must be able to:

* [ ] view companies
* [ ] add company
* [ ] edit company
* [ ] disable company
* [ ] edit career URL

---

# Phase 6 — Basic Crawler

Implement:

```text
fetch
+
Cheerio
```

Features:

* [ ] open career page
* [ ] detect job links
* [ ] extract title
* [ ] extract location
* [ ] extract application URL
* [ ] extract description if available

Start with a few companies first.

---

# Phase 7 — Playwright Fallback

Only implement when required.

* [ ] detect JS-heavy company
* [ ] open with Playwright
* [ ] extract jobs
* [ ] close browser properly

Do not use Playwright for every site.

---

# Phase 8 — Job Storage

For every detected job:

* [ ] normalize title
* [ ] normalize URL
* [ ] normalize location
* [ ] create job hash
* [ ] check existing jobs
* [ ] save only new jobs
* [ ] update `last_seen_at`

---

# Phase 9 — Candidate Management

Admin can:

* [ ] add candidate
* [ ] edit candidate
* [ ] deactivate candidate

Candidate fields:

* [ ] name
* [ ] email
* [ ] expertise
* [ ] skills
* [ ] experience
* [ ] preferred locations
* [ ] excluded locations
* [ ] preferred work modes
* [ ] minimum score

---

# Phase 10 — Non-AI Matching

Implement first.

Match:

* [ ] expertise
* [ ] skills
* [ ] location
* [ ] experience
* [ ] work mode

Suggested weights:

```text
Expertise       35
Skills          35
Location        15
Experience      10
Work Mode        5
```

---

# Phase 11 — Hard Exclusions

Implement:

```text
excluded location
→ reject
```

Also reject:

* [ ] inactive candidate
* [ ] closed job
* [ ] incompatible work mode

---

# Phase 12 — AI Service

Create one abstraction:

```text
AIService
```

Possible methods:

```text
extractSkills()
improveMatch()
```

Do not build a large AI framework.

---

# Phase 13 — AI Settings

Create admin settings:

* [ ] AI ON/OFF
* [ ] provider
* [ ] daily request limit
* [ ] skill extraction AI ON/OFF
* [ ] matching AI ON/OFF

When AI is disabled:

```text
use only normal matching
```

When AI fails:

```text
use normal matching
```

---

# Phase 14 — Hybrid Matching

Flow:

```text
Rule Match
    ↓
AI enabled?
 /        \
No        Yes
|          |
Use      AI improvement
score       |
  \        /
   Final score
```

Never allow AI to override excluded locations.

---

# Phase 15 — Email Notifications

Create:

```text
EmailService
```

Initially use SMTP.

Email should include:

* [ ] company
* [ ] job
* [ ] match score
* [ ] location
* [ ] skills
* [ ] application URL

---

# Phase 16 — Prevent Duplicate Emails

Before sending:

```text
candidate + job
```

Check notification table.

If already sent:

```text
skip
```

If not:

```text
send
+
record notification
```

---

# Phase 17 — Daily Digest

Group new jobs per candidate.

Example:

```text
Rahim
 ├─ Job A
 ├─ Job B
 └─ Job C

→ one email
```

This should be preferred over multiple emails.

---

# Phase 18 — Daily Scheduler

Create GitHub Actions workflow.

Run:

```text
once daily
```

Steps:

```text
crawl
→ save jobs
→ match candidates
→ send digest
```

---

# Phase 19 — Basic Admin Dashboard

Build only:

```text
Dashboard
Companies
Jobs
Candidates
Settings
```

Dashboard metrics:

* [ ] companies
* [ ] jobs found today
* [ ] candidates
* [ ] emails sent
* [ ] crawler failures

---

# Phase 20 — Test With 10 Companies

Do not start with the full list.

Choose:

```text
10 companies
```

Test:

* [ ] job detection
* [ ] duplicate detection
* [ ] matching
* [ ] location exclusions
* [ ] AI OFF
* [ ] AI ON
* [ ] email alerts

Fix problems before expanding.

---

# Phase 21 — Expand to 20–50 Companies

* [ ] add additional parsers where necessary
* [ ] use Playwright only where required
* [ ] identify failing career pages
* [ ] verify detected jobs manually

---

# Phase 22 — Full Dataset

Once stable:

* [ ] import remaining companies
* [ ] configure career URLs
* [ ] test in batches
* [ ] enable daily monitoring

---

# Phase 23 — MVP Done

The first version is complete when this works:

```text
Daily Scheduler
      ↓
Companies
      ↓
Career Pages
      ↓
New Jobs
      ↓
Store Jobs
      ↓
Match Candidates
      ↓
Apply Location Rules
      ↓
Optional AI
      ↓
Final Score
      ↓
Email Candidate
      ↓
Record Notification
```

And this must also work when:

```text
AI = OFF
```

---

# Do Not Build Yet

Do not spend time initially on:

* microservices
* message queues
* Kubernetes
* complex AI routing
* four different AI modes
* AI shadow testing
* token-level cost analytics
* complex AI caching
* advanced observability
* dozens of database tables
* candidate authentication
* recruiter CRM
* resume processing
* analytics platform
* multi-channel notifications
* local LLM infrastructure

Build these only when there is a demonstrated need.

---

# Recommended Actual Build Order

```text
1. Clean existing company data

2. Create database

3. Import companies

4. Build crawler

5. Save and deduplicate jobs

6. Add candidates

7. Build non-AI matching

8. Add location rules

9. Send email alerts

10. Schedule daily execution

11. Add AI ON/OFF

12. Add optional AI matching

13. Build simple admin dashboard

14. Expand company coverage
```

That is enough to prove the product.
