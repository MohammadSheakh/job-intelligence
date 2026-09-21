---
name: ferio-frontend-design
description: Build or review Job Intelligence admin and candidate screens with the Ferio visual system, accessible interactions, responsive layouts, and the existing Next/Nest API boundaries.
---

# Ferio frontend design

Start with [frontend instructions](../../../frontend/AGENTS.md), the affected page,
its API contracts, `frontend/app/styles.css`, and the PRD's Ferio requirements.
For Figma-derived work, confirm the role/page mapping in the current PRD and
`docs/gpt-conversation/gpt1.md`; do not implement a comment on the wrong screen.

## Compose the workflow

State the user's task, primary action, information hierarchy, and data source.
Reuse existing page/navigation/form patterns. Separate candidate research browsing
from personalized recommendations. Admin candidate list/new/detail are distinct
follow-up screens; richer diagnostic detail belongs to crawler logs.

Implement loading, empty, validation, pending, success, authorization, and retry
states appropriate to the page. Keep destructive actions distinguishable and
preserve entered values on failure. Avoid displaying backend implementation details
as product copy. Do not invent unavailable execution actions or sample business data.

## Visual language

Use the PRD palette: `#111114`, `#6e6e73`, `#e8e8ea`, `#fafafa`, white. Use semantic
muted color only for status, with text/icon cues beyond color. Use a neutral
system/Inter-style font stack, black primary pill buttons, roughly 10px control/card
radii, hairline borders, and no decorative shadows/gradients/glassmorphism.

Reuse shared styles/tokens rather than introducing per-page visual systems. Keep
operational tables compact and content layouts spacious. Use typography and spacing
to establish hierarchy. Do not restyle unrelated legacy/candidate pages incidentally.

## Accessibility and responsiveness

- Use semantic headings, landmarks, real buttons/links, and visible associated labels.
- Provide keyboard operation and visible focus. Modal/dialog work needs managed focus,
  an accessible name, Escape behavior, and focus return; use an established primitive.
- Associate field errors/help with inputs; announce async results without making
  whole pages noisy live regions. Disabled/loading actions must remain understandable.
- Maintain readable contrast and meaningful target sizes; respect reduced motion.
- Check narrow (~390px) and desktop layouts, long text, empty/large lists, zoom, and
  keyboard flow. Contain necessary table overflow; do not hide essential actions.
- Validate external URLs and auth behavior using the frontend security rules.

## Review evidence

Run applicable static checks. When browser review is available and authorized,
inspect the actual affected screen, keyboard flow, overflow, and error states.
Record reviewed viewports and remaining gaps. If tests/browser work are deferred,
report that explicitly. Screenshots and builds alone do not establish accessibility
or cross-browser conformance. No visual requirement permits changing backend rules.
