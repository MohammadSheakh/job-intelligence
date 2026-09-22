# API contract rules

Applies when adding or changing API routes, authorization, validation, serialization,
or consumers. Read the consuming project's documented contracts before editing.

- Treat routes, verbs, status codes, pagination, and error shapes as compatibility
  boundaries. Coordinate intentional changes across producers and consumers.
- Derive identity from authenticated context; scope resource access to that identity.
  Review guard ordering and intentional authentication exceptions. UI restrictions
  do not enforce backend authorization.
- Bound and validate input using installed tooling. Return explicit projections;
  preserve identifier precision and exclude credentials/internal database fields.
- Translate expected domain failures into safe responses. Match existing error
  consumers; do not introduce a new envelope as incidental cleanup.
- Paginated collections need stable ordering and bounded inputs. Preserve the
  documented contract rather than imposing a template's field names.
- A 204 response has no body; update consumers that otherwise parse JSON.
- Keep DTOs, return types, and consumers aligned. API documentation tooling must
  match installed infrastructure; decorators alone do not establish a contract.
- Review private caching, cookie/CSRF behavior, duplicate mutations, and callback
  authenticity. CORS is neither authorization nor a CSRF defense.
