# Local agent resources

Start with [root AGENTS.md](../AGENTS.md), then the relevant package scope.

- Backend implementation: [Project backend workflow](skills/job-intelligence-backend/SKILL.md).
- Backend review: [coding standards](skills/backend-coding-standards/SKILL.md).
- Frontend design/review: [Ferio UI](skills/ferio-frontend-design/SKILL.md).
- Authorized delivery: [git commit/push](skills/git-commit-push/SKILL.md).
- Instruction changes: [maintenance guide](../docs/agents/instruction-system.md).

The `rules/` files hold engineering policies; living in this folder does not make
them project-specific. Keep application contracts and operational facts in `docs/`.
Scope each rule explicitly; multi-tenant rules do not apply to this single-tenant app.
Other skills are optional task workflows; do not load every skill for every task.
Project guidance and explicit user instructions take priority over generic examples.
