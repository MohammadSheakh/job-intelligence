# Product Requirements Document

## 1. Product Goal

Build a simple system that monitors the career pages of Bangladeshi technology companies, finds new job openings, matches those jobs with registered users, and sends relevant job alerts by email.

The system must support both:

* non-AI matching
* optional AI-assisted matching

The administrator must be able to turn AI on or off to control cost.

---

# 2. Core Use Case

We already have a list of companies containing information such as:

* company name
* website
* careers page
* LinkedIn URL
* email
* technology stack
* location
* employee count
* AIUB alumni count
* comments
* additional notes

The system will organize this data and use the career URLs to monitor job openings.

The basic workflow is:

```text
Company List
    ↓
Career Pages
    ↓
Daily Job Check
    ↓
New Jobs
    ↓
Match Against Users
    ↓
Email Relevant Users
```

---

# 3. Users

There are two types of users.

## Admin

Admin can:

* add companies
* edit companies
* add career URLs
* add users
* edit user skills
* edit location preferences
* see detected jobs
* enable or disable AI
* check whether daily crawling succeeded

## Job Candidate

A candidate has:

* name
* email
* expertise
* skills
* experience level
* preferred locations
* excluded locations
* preferred work mode

Example:

```text
Name:
Rahim

Email:
rahim@example.com

Expertise:
Backend Developer

Skills:
Node.js
TypeScript
PostgreSQL
Docker

Preferred Locations:
Gulshan
Banani
Badda

Excluded Locations:
Uttara
Savar

Work Mode:
Remote
Hybrid
```

---

# 4. Company Data

Each company should contain only the fields we actually need.

```text
id
name

website_url
career_url
linkedin_url

email

tech_stack

city
area
address

employee_count
aiub_alumni_count

comments
additional_notes

active
last_checked_at
```

We do not need complex company intelligence models at the beginning.

---

# 5. Job Data

When a job is found, store:

```text
id
company_id

title
description

location
work_mode

skills
experience

application_url

published_at

first_seen_at
last_seen_at

status
job_hash
```

Possible status:

```text
OPEN
CLOSED
```

---

# 6. Candidate Data

Candidate fields:

```text
id
name
email

expertise
skills
experience_level

preferred_locations
excluded_locations

preferred_work_modes

minimum_match_score

active
```

For the MVP, skills and locations can be stored simply.

We do not need a separate table for every field unless the project grows later.

---

# 7. Daily Job Monitoring

The system will check each active company's career page once per day.

Recommended sequence:

```text
Load active companies
        ↓
Visit career URL
        ↓
Find current jobs
        ↓
Compare with stored jobs
        ↓
Save new jobs
        ↓
Run candidate matching
        ↓
Send alerts
```

---

# 8. Crawling Strategy

Use the simplest method possible.

First try:

```text
fetch
+
Cheerio
```

If a site requires JavaScript:

```text
Playwright
```

We do not need a complex crawling framework in version 1.

A company may require its own small parser if its career page is unusual.

---

# 9. Job Deduplication

The system must avoid treating the same job as new every day.

Create a job hash using something such as:

```text
company
+
job title
+
location
+
application URL
```

If the same hash already exists:

```text
do not create a new job
```

---

# 10. Non-AI Matching

The system must work fully without AI.

Basic matching should consider:

* expertise
* skills
* location
* experience
* work mode

Example score:

```text
Expertise        35%
Skills           35%
Location         15%
Experience       10%
Work Mode         5%
```

Total:

```text
100%
```

---

# 11. Location Rules

Preferred locations increase the match score.

Example:

```text
Preferred:
Gulshan

Job:
Gulshan

→ location bonus
```

Excluded locations are hard filters.

Example:

```text
Excluded:
Uttara

Job:
Uttara

→ do not send
```

AI must not override excluded locations.

---

# 12. AI Support

AI is optional.

The administrator can select:

```text
AI OFF
AI ON
```

When AI is OFF:

```text
normal rule-based matching
```

When AI is ON:

AI can help with:

* understanding unusual job titles
* extracting skills from job descriptions
* improving job-to-user matching

Example:

```text
Candidate:
MERN Developer

Job:
Full Stack JavaScript Engineer
```

The normal matcher may give a moderate score.

AI may understand that these roles are closely related.

---

# 13. AI Cost Control

Admin should have:

```text
AI Enabled
[ON / OFF]
```

Optionally:

```text
Daily AI Call Limit
Monthly AI Call Limit
```

That is enough for the first version.

We do not need a complicated AI budgeting platform initially.

---

# 14. AI Architecture

The code should avoid calling an AI provider directly everywhere.

Use one small service:

```text
AIService
```

Example:

```text
AIService.extractSkills()
AIService.matchJob()
```

If AI is disabled:

```text
skip AI
```

If AI fails:

```text
use normal matching
```

That is sufficient.

---

# 15. Matching Workflow

```text
New Job
   ↓
Check candidate
   ↓
Excluded location?
   |
  YES
   ↓
Reject

NO
 ↓
Rule-based match score
 ↓
AI enabled?
 /       \
NO        YES
|          |
Use       Optional AI
score     improvement
 \         /
  \       /
   Final Score
       ↓
Above candidate threshold?
       |
      YES
       ↓
Create notification
```

---

# 16. Email Notification

The system should preferably send one daily email per candidate.

Example:

```text
3 new jobs match your profile today.
```

Each job should include:

* company
* job title
* match score
* location
* work mode
* matching skills
* application link

Example:

```text
Backend Engineer
ABC Technologies

Match: 88%

Location:
Gulshan

Skills:
Node.js
PostgreSQL
Docker

Apply:
https://...
```

---

# 17. Duplicate Email Prevention

Store notifications.

```text
notifications

id
candidate_id
job_id
sent_at
```

Create a unique rule:

```text
candidate + job
```

This prevents sending the same opportunity repeatedly.

---

# 18. Admin Dashboard

The MVP dashboard only needs these sections:

```text
Dashboard
Companies
Jobs
Candidates
Settings
```

Dashboard should show:

```text
Total Companies
Companies Checked Today
New Jobs Today
Total Candidates
Emails Sent Today
Crawler Failures
```

---

# 19. AI Settings Page

Simple interface:

```text
AI SETTINGS

AI Enabled
[ ON / OFF ]

Provider
[ selected provider ]

Daily Call Limit
[ 100 ]

Matching AI
[ ON / OFF ]

Skill Extraction AI
[ ON / OFF ]
```

Nothing more is required initially.

---

# 20. Technology Stack

Recommended stack:

```text
TypeScript
Node.js
Next.js
PostgreSQL / Supabase

Cheerio
Playwright

GitHub Actions

SMTP / Gmail initially
```

Python is not required.

---

# 21. Scheduling

Use GitHub Actions.

Run once per day.

Example workflow:

```text
GitHub Actions
      ↓
daily-job-check
      ↓
crawl companies
      ↓
store jobs
      ↓
match candidates
      ↓
send emails
```

---

# 22. MVP Database Tables

Keep the first version simple.

Required tables:

```text
companies
jobs
candidates
notifications
settings
```

Optional:

```text
crawl_logs
```

That is enough.

Do not create 15–20 tables before they are needed.

---

# 23. Settings

The settings table can contain:

```text
ai_enabled
ai_provider
ai_daily_limit

default_match_threshold

email_enabled
```

---

# 24. Crawler Logging

We only need enough information to know if something broke.

Store:

```text
company_id
checked_at
success
jobs_found
error
```

This can either be a small table or basic logs initially.

---

# 25. Error Handling

The system should handle:

* website unavailable
* page timeout
* HTML changed
* Playwright failure
* database failure
* AI failure
* email failure

One company failing should not stop the remaining companies.

---

# 26. MVP Success Criteria

The MVP is successful when:

1. company data can be imported
2. companies can be edited
3. career pages can be checked daily
4. new jobs are detected
5. duplicates are prevented
6. multiple candidates can be added
7. candidates can have skills
8. candidates can have preferred locations
9. candidates can have excluded locations
10. jobs can be matched without AI
11. AI can be turned on or off
12. AI failure does not stop matching
13. relevant candidates receive email alerts
14. the same job is not repeatedly emailed
15. basic crawler failures can be seen

That is the real MVP.

---

# 27. Future Features

Only consider these after the MVP works:

* candidate login
* resume upload
* resume parsing
* semantic embeddings
* advanced AI scoring
* Telegram
* WhatsApp
* application tracking
* salary analytics
* AIUB alumni analytics
* company ranking
* complex dashboards
* detailed AI cost analytics
* multiple AI providers
* local LLM support
* advanced crawler monitoring

These should not block version 1.

---

# 28. Final MVP Architecture

```text
             PostgreSQL
                 |
        +--------+--------+
        |                 |
    Companies          Candidates
        |                 |
        v                 |
 Career URLs              |
        |                 |
        v                 |
  Daily Crawler           |
        |                 |
        v                 |
      Jobs ---------------+
        |
        v
 Rule Matching
        |
        v
   AI Enabled?
     /     \
   No       Yes
   |         |
   |     AI Enhancement
   |         |
   +----+----+
        |
        v
    Final Score
        |
        v
    Email Alert
```

This is the scope the first version should stay within.
