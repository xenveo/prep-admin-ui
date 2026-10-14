# Design system

Shared with the candidate app, tuned denser for admin work: smaller type, tighter rows, more on screen. Machine-readable values are in `../tokens/`. Source artboards: `design-source/Main.dc.html` (token sheet) and `design-source/Components.dc.html` (component sheet, light and dark).

## Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FAFAF7` | `#141615` | Page background |
| `--surface` | `#FFFFFF` | `#1B1D1C` | Tables, panels, inputs, sidebar |
| `--ink` | `#1F2937` | `#E7E5E0` | Primary text (14.7:1 on surface) |
| `--ink-muted` | `#6B7280` | `#9CA3AF` | Descriptions, metadata (4.6:1 on bg) |
| `--line` | `#E5E7EB` | `#2E3230` | 1px borders, row dividers |
| `--input-line` | `#D1D5DB` | `#3F4441` | Input borders |
| `--primary` | `#0F766E` | `#2DD4BF` | Primary actions, selected nav, positive change |
| `--on-primary` | `#FFFFFF` | `#0B1F1D` | Text on primary fills |
| `--primary-text` | `#0F766E` | `#5EEAD4` | Teal text and links |
| `--primary-soft` | `#CCFBF1` | `#134E4A` | Selected nav bg, Approved/Active chips |
| `--primary-tint` | `#F0FDFA` | `#16302D` | Selected row, bulk bar, active filter pill |
| `--improve` | `#B45309` | `#F59E0B` | Needs attention, drafts, negative change |
| `--improve-text` | `#B45309` | `#FBBF24` | Amber text |
| `--improve-soft` | `#FEF3C7` | `#451A03` | Attention tints, AI-draft surfaces |
| `--ai-text` | `#92400E` | `#FCD34D` | Text inside AI-draft chips |
| `--error` | `#B91C1C` | `#F87171` | Destructive actions and system errors only |
| `--on-error` | `#FFFFFF` | `#1B1D1C` | Text on error fills |
| `--neutral-soft` | `#F3F4F6` | `#2E3230` | Archived/Deactivated chips, neutral tags, tracks |
| `--neutral-text` | `#4B5563` | `#D1D5DB` | Text on neutral chips |
| `--row-hover` | `#F9FAFB` | `#222524` | Table row hover |
| `--scrim-panel` | `rgba(31,41,55,.24)` | `rgba(0,0,0,.40)` | Behind side panels (list stays readable) |
| `--scrim-modal` | `rgba(31,41,55,.40)` | `rgba(0,0,0,.55)` | Behind modals and confirmations |

Dark mode keeps the same roles with lighter variants. It was proposed by design and approved.

### Readiness bands

Used consistently in chips and charts.

| Band | Score | Light | Dark | Chip tint (light) | Chip tint (dark) |
|---|---|---|---|---|---|
| Interview ready | 85–100 | `#0F766E` | `#5EEAD4` | `#E0F0EE` | `#183B37` |
| Nearly ready | 70–84 | `#5EAAA8` | `#5EAAA8` | `#E3F1F1` | `#1F3533` |
| Developing | 50–69 | `#D9A35B` | `#D9A35B` | `#F8EEDF` | `#3A2F1E` |
| Not ready yet | 0–49 | `#B45309` | `#FBBF24` | `#FEF3C7` | `#3D2E0A` |

**Contrast rule (approved):** Nearly ready and Developing fail against white (2.7:1 and 2.3:1). So:

- **Band chip** = band tint background + 8px dot in the band colour + `--ink` text. Text never sits on a band colour.
- **Charts:** 2px surface-coloured gaps between stacked segments, counts inside segments (white text on Interview ready and Not ready yet in light mode, ink text on the two light bands), plus a legend or direct labels. Never colour alone.
- In dark mode the end bands are the brightest, so the order still reads by lightness.

### Score change

`+24` in `--primary-text` weight 600 · `−5` in `--improve-text` weight 600 (use a true minus sign) · `–` in `--ink-muted` when there is one session or fewer.

## Type

Plus Jakarta Sans 400/500/600/700 (fallback Inter, system-ui). Tabular figures on all numbers. Sentence case. No all-caps.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| Page title | 20 / 28 | 600 | `h1` in page header |
| Section title | 16 / 24 | 600 | Panel and section headings, dialog titles |
| Body | 14 / 22 | 400 | Default |
| Table cell | 14 / 20 | 400 | Names bold 600 |
| Small body | 13 / 20 | 400–500 | Dense panels (session review, editors) |
| Table header | 12 / 16 | 600 | `--ink-muted`, sentence case |
| Metadata | 12 / 16 | 400 | Emails, timestamps, helper text |

## Layout

- 8px grid. Spacing scale 4, 8, 12, 16, 24, 32, 48 (4 only for icon-to-label gaps).
- Sidebar 240px, collapsible to 64px (icons with tooltips). Collapsed by default below 1280px and on the session review page.
- Main area: padding 24px 32px (24px horizontal at 1024). Page header = title + one-line description on the left, one primary action on the right.
- Side panel 560px, overlays the list from the right, list dimmed with `--scrim-panel` but readable.
- Modal 640px (invite), confirmations 440–480px.
- Table rows 44px (52px when a cell has two lines). Table header 40px.
- Controls 36px tall, 44px minimum hit area. Small buttons 32px.
- Radius 8px panels, inputs, buttons · 6px menus' inner items and segmented items · 999px chips · 12px candidate-app flash card.
- Borders 1px. **Shadows only** on side panels and modals (`0 12px 32px rgba(31,41,55,.16)`), menus (`0 8px 24px rgba(31,41,55,.12)`) and toasts.

## Chips

24px tall, 12px / 500, padding 0 10px, radius 999px. Rule: **outline = not live yet, fill = live, gray = inactive, dashed = AI draft.**

| Chip | Background | Text | Border |
|---|---|---|---|
| Draft | transparent | `--improve-text` | 1px solid `--improve` |
| AI draft | `--improve-soft` | `--ai-text` | 1px dashed `--improve` |
| Approved | `--primary-soft` | `--primary-text` | none |
| Archived | `--neutral-soft` | `--neutral-text` | none |
| Invite pending | transparent | `--improve-text` | 1px solid `--improve` |
| Active | `--primary-soft` | `--primary-text` | none |
| Revoked | transparent | `--neutral-text` | 1px solid `#D1D5DB` / dark `#4B5563` |
| Deactivated | `--neutral-soft` | `--neutral-text` | none |
| "N to review" badge | `--improve-soft` | `--ai-text` | 1px dashed `--improve`, weight 600 |

Red is never used for a status.

## Focus

2px `--primary` outline, 2px offset on controls; `-2px` offset (inset) on table rows and list items. Never remove focus outlines.

## Icons

Custom 1.8px stroke line icons, 18px in nav and 16px in controls, `currentColor`. No stock icon packs. The canvas source has every icon path inline.

## Voice and copy

- Sentence case, plain words, short.
- Describe preparedness and growth: "Nearly ready", "+24 since first session", "needs attention". Never hiring decisions.
- Destructive dialogs: "[Verb] [object]?" title + what stops working + what is kept + whether it can be undone. See `interaction-and-a11y.md`.
- Missing values show `–` in `--ink-muted`, never `0` or blank.
