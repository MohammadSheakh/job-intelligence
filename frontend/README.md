# Job Intelligence frontend

This is the target Next.js frontend for both the Admin and Candidate views.
It communicates only with `backend/` through the versioned API and never
connects directly to Neon/PostgreSQL. The legacy rendered UI remains the
behavioral reference until feature parity is verified.

## Implemented routes

- `/candidate/login` and `/candidate`: candidate authentication and overview.
- `/candidate/change-password`, `/candidate/profile`, `/candidate/companies`,
  and `/candidate/pipeline`: core candidate workflows.
- `/admin` redirects to `/admin/companies`: company search/filter/pagination.
- `/admin/companies/[id]`: company research/contact/category editing.
- `/admin/categories`: category creation and type updates by name.

Admin sign-in uses the backend's `ADMIN_USERNAME` and `ADMIN_PASSWORD` through
Basic authorization. Credentials remain in React memory, never browser storage;
refresh or sign-out requires signing in again. Candidate cookies do not authorize
admin requests. Use HTTPS in production as required by the PRD.

Set `NEXT_PUBLIC_API_URL` to the backend API base (default
`http://localhost:4000/api/v1`) and set the backend's `FRONTEND_ORIGIN` to the
frontend origin (default `http://localhost:3000`). Run `pnpm --dir frontend dev`
from the repository root after installing dependencies. Use `pnpm check:style`,
`pnpm --dir frontend typecheck`, and `pnpm --dir frontend build` for local checks.
`pnpm --dir backend test:browser` exercises candidate and admin flows against
synthetic data; see `backend/test/README.md` for Docker/Chromium prerequisites.
