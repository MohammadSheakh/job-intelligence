# Transaction and side-effect boundaries

Applies to multi-write use cases, imports, crawl persistence, quotas, and workers.

1. Identify the invariant and all writes that must succeed or roll back together.
2. Use one explicit Prisma transaction for a cohesive unit. All participating
   queries must use that transaction client; a query on the root client escapes it.
3. Keep network calls, email, AI, sleeps, and long parsing outside the transaction.
   Set realistic time/size bounds and preserve failure details without leaking secrets.
4. Use unique constraints, atomic updates, or scoped locking to handle races.
   Define idempotency, retries, and duplicate delivery before introducing them.
5. Commit before external delivery; use a durable outbox if reliable asynchronous
   side effects are required. A fire-and-forget promise is not durable processing.

A focused aggregate repository can own an internal transaction. Existing service
transactions are supported. Pass a typed transaction client inside a small private
persistence boundary when needed; never accept an optional transaction that
silently falls back to the root client. For substantial cross-aggregate coordination,
consider an explicit unit of work, but introduce AsyncLocalStorage only with a
concrete need, propagation design, and runtime evidence. It is not existing infrastructure.

Document what a lock protects and what it does not: in-process guards do not
coordinate replicas; session locks are not fencing tokens; upserts do not make
external side effects exactly-once. Release resources in finally paths. Failed
persistence of required diagnostics must be visible, not swallowed.

When verification is authorized, choose rollback/race/retry cases that exercise
these invariants. If tests are deferred, record the unverified behavior rather
than calling concurrency correct on the basis of compilation.
