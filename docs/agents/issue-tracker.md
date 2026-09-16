# Issue tracker: Local Markdown

Issues and specs live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Spec: `.scratch/<feature-slug>/spec.md`.
- Tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01`, one file per ticket.
- Record triage state in a `Status:` line near the top.
  Use the roles in `docs/agents/triage-labels.md`.
- Append discussion under `## Comments`.
- Link to relevant requirements in `PRD.md` and status entries in
  `IMPLEMENTATION_CHECKLIST.md`.
- Verify outstanding work before converting historical checklist items
  into tickets.

## Publishing and fetching

“Publish to the issue tracker” means create the corresponding local file.
“Fetch the relevant ticket” means read its referenced file.
Resolve ticket numbers within the specified feature directory.

## Wayfinding

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far,
  and Fog.
- Children: individual numbered files in `.scratch/<effort>/issues/`.
- Record ticket type in `Type:`: research, prototype, grilling, or task.
- For wayfinding tickets, `Status:` tracks open, claimed, or resolved.
  Record any separate triage role in `Triage:`.
- Record dependencies as `Blocked by: NN, NN`.
- A ticket is unblocked when all listed dependencies are resolved.
- Select the first open, unblocked, unclaimed ticket by number.
- Claim by setting `Status: claimed` before starting work.
- Resolve by appending `## Answer`, setting `Status: resolved`,
  and adding a summary and link to the map's Decisions-so-far.
