# Skill mechanics

Read for skill packaging or invocation metadata changes. Use
[writing guidance](SKILL.md) for scope, routing, and progressive disclosure.

## Portable entrypoint

Keep `name` and a precise `description` in `SKILL.md` frontmatter. State when the
workflow applies; do not assume a folder name alone establishes its trigger.
Keep conditional examples and procedures in linked references. A Markdown link
makes material discoverable; it does not guarantee that every editor automatically
loads it or invokes a second skill.

## Host-specific invocation

Invocation controls belong to the host's supported configuration. Do not treat
`disable-model-invocation` as a portable switch or remove required descriptions
to simulate it. For this repository's Codex UI metadata, invocation policy lives
in `agents/openai.yaml` under `policy.allow_implicit_invocation`. Preserve existing
policy unless the user requests a change; default discovery does not authorize
external actions.

Keep `interface.default_prompt` aligned with `$<skill-directory-name>` when a skill
is renamed. Verify supported fields against the active skill-authoring instructions
before introducing settings for another host. Do not translate one host's setting
into another by name alone.

## Routing and validation

Link references with a loading condition. Split only when it saves irrelevant
context; a short self-contained workflow does not need a router. References can
be shared without becoming independently invokable skills.

Run `pnpm check:agents` for repository links, names, and UI invocation checks.
Use the skill-authoring validator for full supported frontmatter checks. Structural
success does not establish that the workflow chooses correctly; review realistic
requests and record observed failures before tightening instructions.
