# Quick Search

This module owns persistent quota accounting and bounded company selection.
The candidate portal exposes usage reads only. Reservation is an internal
building block, not an HTTP action, queue, or complete Quick Search implementation.

Before adding execution, implement the crawler adapter and run finalization;
validate mode availability before reserving; never keep the quota transaction
open during network requests. See `docs/BACKEND_DEVELOPER_GUIDE.md` for locking,
Dhaka day boundaries, SQL rationale, and remaining work.
