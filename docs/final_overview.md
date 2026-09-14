this doc is created before add docker and local db and neon db shift feature

Not fully complete for production yet, but the **main MVP application is mostly built**.

The structure is:

```text
ONE application / ONE Node.js server
        |
        +-- Admin area
        |
        +-- Candidate portal
```

So admin and candidate use the **same deployed application and same Neon database**, but they do **not** see the same interface.

### Admin

Admin uses the operational/admin interface.

Typical routes:

```text
/
 /companies
 /jobs
 /candidates
 /crawl-logs
 /settings
```

Admin can manage:

* companies
* categories
* jobs
* candidates
* candidate interests/preferences
* NHPF status
* AI settings
* crawler settings
* Quick Search rate limits
* email settings

Admin authentication is separate from candidate authentication.

The current `.env` has:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
```

So the current admin username is intended to be:

```text
admin
```

but **there is currently no valid admin password configured**.

You must put one in `.env`, for example:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongPasswordHere
```

I deliberately did not invent/embed a real admin password in the downloadable ZIP.

---

### Candidate

Candidates have their own portal:

```text
/portal/login
/portal
/portal/profile
/portal/companies
/portal/pipeline
```

Candidate sees things like:

* Recommended jobs
* Quick Job Search
* Search with AI / without AI
* Remaining daily search quota
* Profile
* Skills/interests
* Preferred/excluded locations
* Preferred/excluded categories
* Planning companies
* Applied companies
* Latest applied date
* Reapply count
* Blacklist
* Password change

So visually they share the same **Ferio design language**, but they are different screens for different roles.

For example:

```text
ADMIN
Companies | Jobs | Candidates | Crawler | Settings
```

versus:

```text
CANDIDATE
Jobs | Companies | Pipeline | Profile | Quick Search
```

### Candidate credentials

For newly created candidates, your requested default is:

```text
password: asdfasdf
```

The application hashes it before storage and forces the candidate to change it.

For Mohammad:

```text
Email:
mohammad.sheakh@gmail.com

Intended initial password:
asdfasdf
```

But there is one important distinction: **Mohammad's existing Neon account does not yet have that password hash initialized** because the database connector blocked that credential write from this chat.

From the deployed project you run once:

```bash
npm run candidate:set-default-password -- \
  --email mohammad.sheakh@gmail.com
```

Then Mohammad can log in with:

```text
mohammad.sheakh@gmail.com
asdfasdf
```

and will be prompted to change the password.

### What is already complete

The major product pieces are implemented:

* companies database
* categories and multi-category companies
* NHPF handling
* crawler
* jobs
* deterministic matching
* optional AI matching
* candidate profiles
* admin candidate creation
* email/password candidate login
* Google-login flow
* Quick Search
* AI / non-AI Quick Search
* daily rate limiting
* job recommendations
* Planning
* Applied
* latest application date
* reapply count
* Blacklist
* candidate profile editing
* admin settings
* Ferio design
* scheduled daily crawler
* email notification architecture

### What is still needed before I would call it fully production-complete

A few deployment/integration items remain:

* Fill the real `.env` secrets.
* Initialize Mohammad's password.
* Configure Google OAuth if you want Google login.
* Configure SMTP if you want actual emails.
* Configure AI API credentials if AI mode should work.
* Install dependencies and run a full project typecheck/build in a network-enabled environment.
* Run the migrations once against the deployed database and verify them end-to-end.
* Deploy the web server somewhere.
* Run one real browser test of admin login, candidate login, Quick Search, Apply/Planning/Blacklist, and password change.
* Run the GitHub daily crawler in its actual network environment.

So I would describe it as **feature-complete MVP code, but not yet fully deployment-tested production software**.

The architecture is exactly what you want:

```text
job.yourdomain.com
        |
        +-- Admin login
        |      ↓
        |   Admin dashboard
        |
        +-- /portal/login
               ↓
          Candidate dashboard
```

Same application and design system, **different authentication and different views based on role**.
