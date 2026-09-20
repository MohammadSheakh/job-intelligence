# Job Intelligence frontend

This is the target Next.js frontend for both the Admin and Candidate views.
It communicates only with `backend/` through the versioned API and never
connects directly to Neon/PostgreSQL. The legacy rendered UI remains the
behavioral reference until feature parity is verified.
