# PrepPilot admin console

You are building the **admin console** of PrepPilot (working name), an invite-only AI interview-prep tool. Candidates study flash cards for an admin-approved job role, then do a voice mock interview. The AI gives feedback after every answer, re-asks the question, and ends with a 0–100 **preparedness score** and a **readiness band**. The goal is growth: moving candidates from low to high preparedness.

Admins (recruiters, trainers, program managers) use this console to:

1. Invite candidates (single email or CSV) and assign job roles.
2. Create job roles and their content: flash cards, interview questions, scoring rubrics. AI can draft content; admins review and approve.
3. Approve a role so assigned candidates can see it.
4. Monitor progress: who is ready, who is stuck, which questions are hardest.
5. Review any session (transcript, AI feedback, scores) and flag wrong AI scoring.

## Where things are

All design material lives in `docs/design/preppilot-admin/` (adjust if you moved it):

- `docs/screens.md` — the spec for every screen. **Build from this.**
- `docs/design-system.md`, `tokens/` — colours, type, spacing. **Never hard-code a colour that isn't a token.**
- `docs/components.md` — the shared component layer. Build these before screens.
- `docs/interaction-and-a11y.md` — keyboard, focus, ARIA. Non-negotiable.
- `docs/domain-model.md` — entities, statuses, scoring formula, bands.
- `docs/implementation-plan.md` — build order and checkpoints.
- `docs/open-questions.md` — what is decided, what is illustrative, what is still open.
- `data/sample-data.json` — fixtures that match the designs exactly.
- `design-source/*.dc.html` — original canvas source. When the spec and the source disagree on a pixel value or a string, the source wins; when they disagree on behaviour, ask.

## Hard rules (from the design brief)

1. **Tables first, side panels for detail.** Lists are tables (not card grids). Detail opens in a 560px right side panel over a dimmed but visible list, not a new page. Exceptions: the role editor (A5–A7) and session review (A8) are full pages.
2. **One primary action per page header.** In empty states the header primary hides so the empty state holds the only primary button.
3. **Status is always a chip with a consistent colour** (see `docs/design-system.md` › Chips). Same chip, same colour, every screen.
4. **Every AI-generated item is labelled "AI draft"** (dashed amber chip) until an admin approves it. AI drafts are never visible to candidates.
5. **Destructive actions always confirm** (revoke, deactivate, archive, remove, discard) and the dialog says exactly what happens, what is kept and whether it can be undone. Red (`--error`) appears only on the destructive button and on system errors.
6. **Preparedness, not hireability.** Never use hiring-decision language: no "reject", "pass/fail", "hire", "shortlist", "rank". Use the band names exactly: Interview ready, Nearly ready, Developing, Not ready yet.
7. **No red for low scores.** Low = amber family. Score change: teal for up, amber for down, "–" when there is only one session.
8. **Avoid:** KPI card rows with gradients or trend arrows on every number, stock icon packs, all-caps labels or table headers, confetti.
9. **Numbers:** tabular figures everywhere (`font-variant-numeric: tabular-nums`); numeric table columns are right-aligned.
10. **Accessibility is WCAG 2.1 AA:** keyboard-navigable tables (↑ ↓ Home End move, Enter opens the panel, Esc closes and returns focus to the row), visible focus, every chart has a "Show as table" alternative.

## Look and feel

Calm, efficient, data-dense without clutter. Desktop first at 1440, usable at 1024 (sidebar collapses to 64px), mobile view-only and low priority. Plus Jakarta Sans (fallback Inter, system-ui). 8px grid, 44px table rows, 8px radius on panels and inputs, 999px on chips, 1px borders, shadows only on side panels, modals, menus and toasts. Sentence case everywhere.

## How to work

- Follow `docs/implementation-plan.md` phase by phase and stop at each checkpoint for review.
- Build the token layer and shared components first; screens compose them.
- Use `data/sample-data.json` for fixtures, stories and tests so screens match the designs.
- Treat anything marked `"source": "illustrative"` as placeholder data; don't hard-code it into product logic.
- Never wire real side effects (sending email, deleting data) without an explicit backend task. Until then, actions call stubbed services.
- If something in the spec is ambiguous or contradicts these rules, ask instead of guessing. Known open items are in `docs/open-questions.md`.

## Definition of done for any screen

- [ ] Matches `docs/screens.md` layout, copy and every listed state (default, empty, loading, error, no results where relevant).
- [ ] Uses only tokens from `tokens/`; light and dark both work.
- [ ] Keyboard-only walkthrough works; focus is always visible and returns to the trigger when a panel or dialog closes.
- [ ] axe (or equivalent) reports no violations; charts have table alternatives.
- [ ] Destructive actions confirm with the exact copy pattern in `docs/interaction-and-a11y.md`.
- [ ] Works at 1440 and 1024 widths without horizontal page scroll (wide tables scroll inside their container).
