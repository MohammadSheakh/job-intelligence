# Transaction review reference

Follow the project-owned [transaction rules](../../../rules/backend-transactions.md).

Identify all reads/writes participating in the invariant, prove they use the
same transaction boundary, and inspect rollback and retry behavior. Keep HTTP,
AI, email, parsing, and delays outside the transaction. Explicit Prisma
transactions are the existing supported mechanism; ambient unit-of-work machinery
is a deliberate future design, not a prerequisite for every backend task.

Distinguish aggregate persistence from external side effects and distributed
execution. A database lock is not exactly-once delivery. Report runtime evidence
or its absence for rollback, lock loss, retries, and duplicate delivery.
