# Frontend architecture

Applies to Next App Router code. Read [frontend scope](../../frontend/AGENTS.md).

- The Nest API owns business rules and persistence. Reuse the existing API helpers;
  no Prisma imports or direct database access from Next components/actions/routes.
- Prefer Server Components for static structure and server-owned data. Keep client
  boundaries focused on interactivity, browser state, or current authentication needs.
  Existing credentialed client API flows are intentional; do not replace them with
  an incomplete server-rendering/auth migration just to follow a generic preference.
- Anything imported through a client boundary may reach the browser bundle. Keep
  secrets/server-only code outside it. Confirm version-specific caching and framework
  APIs against installed Next/React versions before adopting examples.
- Separate page composition, interactive feature components, and API contracts when
  responsibilities diverge. Extract shared UI only after a real reusable pattern emerges.
- Model loading, success, empty, validation, forbidden/unauthenticated, and failure
  states. Cancel superseded reads or ignore stale results. Clear pending state on errors.
- Prevent duplicate mutations, preserve user input on failure, and reconcile all rows
  affected by a company-level action. Optimistic changes require rollback behavior.
- Bound lists at the API. Use server pagination/filtering, preserving query state where
  useful; do not fetch the entire catalog for a client-side slice.
- Use typed response contracts and stable entity keys. Loading/retry regions should
  not unnecessarily blank unrelated working sections or move keyboard focus.
- Keep business copy in product terms; migration/internal implementation details belong
  in docs. Use the Ferio design skill for visual and accessibility requirements.
