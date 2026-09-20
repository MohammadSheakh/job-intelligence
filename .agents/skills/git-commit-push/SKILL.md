---
name: git-commit-push
description: Finish requested repository work with a reviewed conventional commit and branch push when the user explicitly asks for commit or push.
---

# Git Commit And Push

Use this workflow when the user explicitly requests a commit, a push, or both.

## Workflow

1. Identify the correct repository, current branch, configured remote, and working-tree state.
2. Review the diff before staging. Preserve unrelated user changes and untracked files.
3. Stage only files belonging to the current task. Never stage secrets such as `.env` files.
4. Run relevant validation and report failures honestly; do not hide known test or type-check failures.
5. Review the staged diff and generate a semantic Conventional Commit message.

## Commit Message

Analyze the diff to determine:

    Type: What kind of change is this?
    Scope: What area/module is affected?
    Description: One-line summary of what changed (imperative mood, <72 chars)

The subject must use the Conventional Commits form `type(scope): description`.
The subject must be followed by a blank line and a concise 2–4 line body that
explains the important implementation change, reason, and validation performed.
Use a footer only when the change needs issue, breaking-change, or reviewer
metadata. Do not create a subject-only commit unless the user explicitly asks
for a minimal commit message.

## Commit Structure

git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<implementation change and why it matters>
<validation performed and any important remaining limitation>

<optional footer>
EOF
)"

6. Verify the commit was created, then push only the requested current branch to its configured remote.
7. Verify the final status and report the commit hash, branch, remote, and any remaining changes.

## Safety Rules

- Do not commit or push unless the user asked for it.
- Never force-push, amend, reset, clean, or discard changes unless explicitly requested.
- Do not include unrelated work, generated artifacts, credentials, or local environment files.
- If a push fails, report the reason and do not switch branches or use a destructive workaround.
