# PrepPilot admin console — design handoff

Design handoff for the **PrepPilot admin console** (working name), an invite-only AI interview-prep tool. This package is meant to be dropped into a code repository and used by Claude Code (or any engineer) to build the admin UI.

- **Status:** design approved for build, v0.1 · 15 Oct 2026
- **Designer / owner:** Dipanshu Bisht (Xenveo)
- **Source canvas:** PrepPilot admin console (Claude Design canvas; private, ask the owner for access)
- **Scope:** admin console only (screens A1–A10 plus shared components). The candidate app, backend, auth, email delivery and the AI pipeline are out of scope and not designed here.

## What's inside

| Path | What it is | Read it when |
|---|---|---|
| `CLAUDE.md` | Project brief and hard rules for Claude Code. Copy it to your repo root (or merge into an existing one). | Always, first |
| `docs/design-system.md` | Tokens, type, layout, chips, bands, light and dark | Before writing any UI |
| `docs/components.md` | Component inventory: variants, states, props, where used | Building the shared component layer |
| `docs/screens.md` | Screen-by-screen spec A1–A10: layout, states, copy, behaviour, acceptance criteria | Building each screen |
| `docs/interaction-and-a11y.md` | Keyboard model, focus, ARIA patterns, chart alternatives, confirmations | Building tables, panels, dialogs, charts |
| `docs/domain-model.md` | Entities, statuses, scoring formulas, bands, permissions, lifecycles | Modelling data and API contracts |
| `docs/implementation-plan.md` | Ordered build plan with checkpoints | Planning the work |
| `docs/open-questions.md` | Decisions made, illustrative data to replace, open gaps | Before treating any number as real |
| `tokens/` | `tokens.json`, `tokens.css` (light + dark custom properties), `tailwind.preset.js` | Setting up styling |
| `data/sample-data.json` | Seed data that matches every screen | Fixtures, stories, tests |
| `design-source/` | The original canvas source (`.dc.html`) for every artboard, plus a map and format notes | When a spec is ambiguous: the source is the truth for spacing, colour and copy |
| `screenshots/` | Empty: export PNGs from the canvas and drop them here (see its README) | Visual reference |

## How to use it with Claude Code

1. Copy this folder into your repo, e.g. `docs/design/preppilot-admin/`.
2. Copy `CLAUDE.md` to the repo root (or paste its contents into your existing `CLAUDE.md`) and fix the paths in its "Where things are" section if you placed the folder elsewhere.
3. Optional but recommended: export screenshots from the canvas into `screenshots/` (names listed in `screenshots/README.md`).
4. Start Claude Code in the repo and give it a first prompt such as:

   > Read CLAUDE.md and docs/design/preppilot-admin/docs/implementation-plan.md. Tell me which stack you'll use given this repo, then do phase 1 (tokens and the shared component layer) only. Stop after phase 1 and show me what you built.

5. Work phase by phase. Each phase in the plan ends with a checkpoint you can review.

## Important caveats

- **Illustrative numbers.** Some figures on the canvas were invented to fill the layouts (for example the Reports baseline band split and the dimension averages). They're listed in `docs/open-questions.md` and flagged `"source": "illustrative"` in `data/sample-data.json`. Don't ship them as real data.
- **The `.dc.html` files don't run outside the Claude Design canvas.** They need the canvas runtime. Treat them as annotated reference markup: inline styles give exact values, the `<script type="text/x-dc">` block shows state and behaviour. See `design-source/README.md`.
- **Mockup behaviour only.** Nothing in the designs sends invites, approves roles or deletes data. All of that needs a real backend.
