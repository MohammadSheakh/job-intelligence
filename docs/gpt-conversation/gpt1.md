Yes — I re-checked the Figma canvas and, importantly, traced **where each arrow actually points**. Your requested table format is much better because it preserves the context of every comment.

Two mappings from my previous answer needed correction: **“move this candidate list section to different page” points to the Admin Candidates area**, not the dashboard; and **“we need more details” points to the Admin Crawler Logs/Status screen**, not candidate details.

| Role          | Page / section in Figma                                                                       | Figma comment                                                                                                                                                     | Current PRD / checklist status                                                                                                                                                 | What should change                                                                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Admin**     | **Companies → Manual Review / company list** `(image 2 area)`                                 | “jegular manual review ase .. shegula review kore complete korte hobe”                                                                                            | ❌ **Missing as a workflow.** Company review flags/status exist, but PRD does not define how admin processes and completes reviews.                                             | Add a **Manual Review queue/filter**. Show review reason, source data, website/career/LinkedIn, categories, notes. Admin can edit and **Complete Review**. Completing it clears `needs_manual_review` and recalculates the next action/status.                                                   |
| **Admin**     | **Companies → Company management / Add Company / enrichment** `(image 2 area)`                | “admin should add new company, and we need something that `ENRICH_FROM_LINKEDIN` go to linked in and find website link ... if career page found update that also” | ⚠️ **Partial.** PRD says Admin manages companies, but explicit **Add Company** and enrichment lifecycle are not defined.                                                       | Add **+ Add Company**. Add a controlled `ENRICH_FROM_LINKEDIN` workflow: identify official website → save `website_url` → inspect official site for career page → save `career_url` → update action to `MONITOR_READY`, `FIND_CAREER_PAGE`, or `NHPF`. Do not bypass LinkedIn anti-bot controls. |
| **Admin**     | **Companies → Company table → Website/Career/LinkedIn columns** `(image 2, lower table area)` | “url link should be clickable .. to open in a new browser tab”                                                                                                    | ❌ **Missing explicit UI requirement.**                                                                                                                                         | Make Website, Career Page and LinkedIn clickable external links. Use a readable label such as `Website ↗`, `Career page ↗`, `LinkedIn ↗`; open with `target="_blank"` + `rel="noopener noreferrer"`.                                                                                             |
| **Admin**     | **Jobs → Jobs table/list** `(image 7)`                                                        | “try to get the deadline also and do not fetch backdated opening — also company name should be clickable...”                                                      | ⚠️ **Partial.** Checklist says deadline/expired extraction exists, but PRD does not fully define deadline persistence/display/freshness. Company-name linking isn't specified. | Persist/display `application_deadline`; reject expired vacancies from OPEN recommendations; don't treat an old publish date alone as expired. Add freshness rules for clearly historical jobs. Make **company name → official website**, and Apply → application URL.                            |
| **Admin**     | **Candidates → Add/Edit Candidate form** `(image 9)`                                          | “experience level should be drop down with more option .. like junior mid senior .. also how many years .. we can add new field”                                  | ⚠️ **Partial.** `experience_level` exists, but controlled options and numeric years do not.                                                                                    | Change level to dropdown: Student/Intern, Fresher/Entry, Junior, Mid, Senior, Lead/Principal, Manager. Add `experience_years`. Later matching should use numeric years when jobs provide them.                                                                                                   |
| **Admin**     | **Candidates → Candidate list section** `(image 10)`                                          | “move this candidate list section to different page”                                                                                                              | ⚠️ **Partial.** PRD has a Candidates page, but it does not say the list must be separated from candidate create/edit UI.                                                       | Split the workflow: `/candidates` = candidate list; `/candidates/new` = add candidate; `/candidates/:id` = candidate details/edit. Do not place the full candidate list underneath the creation form.                                                                                            |
| **Admin**     | **Crawler Logs / Status → log table/details** `(image 11)`                                    | “we need more details”                                                                                                                                            | ⚠️ **Partial.** Crawler logs page exists, but PRD only requires crawler status/logs; it doesn't define diagnostic depth.                                                       | Expand crawl details: company, career URL, checked time, result, jobs found, HTTP/result status where available, crawler/adapter used, duration, error/message, previous/next action. Add a log-detail view or expandable row for errors.                                                        |
| **Candidate** | **Companies → company browsing/list** `(image 14)`                                            | “what companies showing here ? may be need pagination”                                                                                                            | ❌ **Missing definition.** PRD only says Candidate has a Companies page. It doesn't define inclusion rules or pagination.                                                       | Define it as **active companies available for candidate research/tracking**, independent of whether they currently have a matching job. Add search/filter and **server-side pagination**, e.g. 25/page. Show candidate's Planning/Applied/Blacklist state beside each company.                   |

### The corrected context matters

The Figma flow now reads much more clearly.

The **Admin Companies screen** has three separate requirements attached to it: manual-review completion, adding/enriching companies, and clickable URLs. Those should probably be designed and implemented together because they're all part of one company-management workflow.

The **Admin Jobs screen** owns the deadline/backdated-job requirement. That should update the crawler/job model as well as the UI—it isn't just a table change.

The **Admin Candidates area** actually has two related comments: one about the candidate form (`experience level + years`) and another about information architecture (`move the candidate list to its own page`). So I would restructure Admin Candidates as:

```text
/candidates
    Candidate list

/candidates/new
    Add candidate

/candidates/:id
    Candidate details + edit
```

The **“we need more details”** comment is especially important: after rechecking the arrow position, it points to the **Crawler Logs/Status screen**. So my previous interpretation about “richer candidate details” was incorrect. The requirement should instead make crawler diagnostics substantially more useful.

For example, a log row/detail should eventually communicate something like:

```text
Company
eGeneration Ltd

Career page
https://...

Checked
20 Sep 2026 · 06:15

Result
SUCCESS

Jobs found
13

Crawler
Generic HTML

Duration
1.4s

Changes
2 new · 11 unchanged

Next action
MONITOR_READY
```

And failures should tell Admin something actionable:

```text
RESULT
FAILED

Reason
403 / access challenge

Action
CUSTOM_ADAPTER_REQUIRED
```

For **Candidate → Companies**, I would formalize exactly what the page contains:

```text
All active companies
minus anything intentionally hidden/inactive

NOT only companies with open jobs
NOT only companies matching the candidate
```

Recommendations remain personalized; Companies is a research/tracking directory.

Then pagination can be:

```text
25 companies/page

Search
Category
Location
My status:
All / Planning / Applied / Blacklist
```

That distinction makes the candidate UX much easier to understand.

So after rechecking Figma, I would now treat the comment set as **8 requirements tied to 6 specific product areas**: Admin Companies, Admin Jobs, Admin Candidate form, Admin Candidate list/navigation, Admin Crawler Logs, and Candidate Companies.

This is the table format I’ll use from now on whenever we analyze new Figma comments: **Role → Page/Section → Exact Figma Comment → Current PRD/Checklist Status → Required Change**.
