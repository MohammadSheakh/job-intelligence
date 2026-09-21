# Frontend security

- Candidate cookies are HTTP-only session credentials. Reuse status/code-based
  auth redirects. Candidate sessions never authorize admin operations.
- Admin Basic credentials stay in the current memory-only provider. Do not store
  them in localStorage/sessionStorage, URLs, logs, or NEXT_PUBLIC environment values.
  Refresh/sign-out/401 clears the active admin context as the implemented contract requires.
- UI hiding is not authorization. Backend guards and ownership checks protect every
  action. Never trust a candidate ID supplied by a form to select account data.
- Treat NEXT_PUBLIC values and client module imports as public. Keep secret-bearing
  code server-only; never copy backend environment files into frontend artifacts.
- React escaping is the default. Avoid raw HTML injection; an actual rich-content
  requirement needs an explicit sanitization policy. Validate untrusted external link
  schemes as HTTP(S); new-tab links use `rel="noopener noreferrer"`.
- Do not forward cookies/authorization to arbitrary hosts, including redirects or
  user-supplied fetch URLs. Server-side fetching requires the same trust-boundary review.
- Personalized data must not enter a shared public cache. Any introduced cache needs
  identity/permission boundaries and invalidation. This project has no tenant IDs to invent.
- Mutations need safe retry/duplicate-submit behavior and CSRF review when cookie-authenticated.
  Return actionable errors without exposing stack traces, SQL, URLs containing credentials,
  or raw provider responses. Do not claim security verification from a build alone.
