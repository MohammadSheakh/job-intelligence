# Reliability and capacity decisions

Applies to throughput-sensitive endpoints, batch/worker execution, external calls,
shared resources, and capacity claims. Small edits do not require a capacity plan.

## Define the workload before choosing infrastructure

For a material capacity change, record the affected operation, peak arrival rate,
burst duration, payload/result sizes, data cardinality, fan-out, latency/error target,
and resource/cost budget. Separate registered accounts, active users, concurrent
requests, and queued jobs. Mark unknowns as assumptions; do not invent measurements.
Use an existing design note or task description rather than requiring a new document
for every change. Introduce infrastructure only to address a stated constraint.

## Bound work and failure amplification

- Bound the whole operation: input, query results, in-flight calls, queue depth,
  response bytes, and end-to-end duration. A timeout does not bound concurrency.
- Propagate cancellation where supported and account for work that continues after
  a caller disconnects. Release connections, locks, and permits in failure paths.
- Give retries one clear owner, a maximum attempt/deadline budget, and backoff with
  jitter where appropriate. Retry only replay-safe failures; layered retries multiply
  load. Honor provider throttling without waiting beyond the operation deadline.
- Define behavior at capacity: reject, defer, or degrade with a documented contract.
  An unbounded in-memory queue is not backpressure. Apply fairness when shared work
  could starve another user or tenant.
- Account for replicas when describing rate limits, locks, connection budgets, and
  concurrency. Process-local controls are not cluster-wide guarantees.

## Make asynchronous outcomes explicit

For durable jobs, identify the persistent state transitions, execution ownership,
lease/heartbeat or recovery strategy, retry limit, and terminal failure handling.
Design duplicate delivery and a crash after side effects but before acknowledgement.
A durable queue does not establish exactly-once effects. Use database constraints,
idempotency keys, or reconciliation according to the invariant.

Keep external delivery outside database transactions. If committing data and
publishing work must survive a crash together, design a durable handoff; do not
substitute a fire-and-forget promise. Preserve useful failure diagnostics without
logging secrets or unbounded payloads.

## Evidence and deployment

Define observable success before rollout: latency percentiles, errors/timeouts,
queue lag, saturation, and relevant business outcomes. Keep metric labels bounded;
put individual user/job identifiers in access-controlled logs rather than unbounded
metric dimensions. Specify alert ownership and recovery steps for new failure modes.

Capacity claims require representative data/workload, environment and replica
configuration, run duration, measurements, bottlenecks, and limitations. Static
analysis supports a design claim, not measured throughput. If verification is
deferred, state the missing evidence and keep the claim provisional.

For operationally significant changes, describe compatible rollout, stop conditions,
rollback or forward repair, and data recovery. A configuration toggle is not rollback
if old code cannot read newly written data. Review backup restoration separately
from backup creation. Follow the task's actual deployment authorization.
