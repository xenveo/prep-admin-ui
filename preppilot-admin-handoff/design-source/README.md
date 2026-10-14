# Design source (Claude Design canvas export)

These are the exact source files of every artboard on the "PrepPilot admin console" canvas, exported 15 Oct 2026. `canvas.json` is the canvas index (artboard positions and titles).

**They don't run on their own.** They need the canvas runtime (`support.js`), which isn't included. Use them as precise reference:

- Inline `style="…"` attributes hold exact sizes, spacing, colours and type.
- Copy strings are literal text in the markup.
- The `<script type="text/x-dc" data-dc-script>` block at the bottom is a small class whose `renderVals()` returns the data and event handlers the template uses. It shows state, derived values and keyboard behaviour.

## Format cheat sheet

| Syntax | Meaning |
|---|---|
| `{{ path }}` | Value from `renderVals()` (dotted lookup) |
| `<sc-if value="{{ cond }}">` | Render children when `cond` is true |
| `<sc-for list="{{ items }}" as="item">` | Repeat children per item |
| `<dc-import name="X" prop="…">` | Embed `X.dc.html` as a child component with props |
| `onClick="{{ handler }}"`, `onKeyDown=…` | Event handlers returned by `renderVals()` |
| `data-props='{…}'` | Declared props (e.g. a `view` enum that picks which state the artboard shows) |

## File map

| File | Screen / state | Notes |
|---|---|---|
| `Main.dc.html` | Design tokens v0.1 | Token sheet (light) |
| `Components.dc.html` | Shared component sheet, light | prop `theme` |
| `ComponentsDark.dc.html` | Shared component sheet, dark | wraps Components |
| `Sidebar.dc.html` | Sidebar component | props `active`, `collapsed` |
| `Candidates.dc.html` | A1 default (row menu open) | prop `view`: default, plain, selected, noresults, empty, panel-priya, panel-karan. Contains keyboard grid, bulk bar, confirms, side-panel host |
| `CandidatesSelected.dc.html` | A1 bulk selected | wraps Candidates |
| `CandidatesNoResults.dc.html` | A1 filtered, no results | wraps Candidates |
| `CandidatesEmpty.dc.html` | A1 first use | wraps Candidates |
| `InviteModal.dc.html` | A2 one by one | prop `view`: one, csv, validate |
| `InviteCsv.dc.html` | A2 upload CSV | wraps InviteModal |
| `InviteValidate.dc.html` | A2 CSV validation | wraps InviteModal |
| `InviteSuccess.dc.html` | A2 success toast | |
| `CandidatePanel.dc.html` | A3 panel component | prop `cid`: priya, ananya, rahul, karan |
| `CandidatesPanelPriya.dc.html` | A3 Priya Sharma | wraps Candidates |
| `CandidatesPanelKaran.dc.html` | A3 Karan Singh, invite pending | wraps Candidates |
| `JobRoles.dc.html` | A4 active | prop `view`: active, archived, empty |
| `JobRolesEmpty.dc.html` | A4 empty | wraps JobRoles |
| `RoleEditor.dc.html` | A5 Details | prop `view`: details, settings, approve |
| `RoleEditorSettings.dc.html` | A5 Settings | wraps RoleEditor |
| `RoleEditorApprove.dc.html` | A5 approve dialog | wraps RoleEditor |
| `RoleCards.dc.html` | A6 flash cards | |
| `RoleQuestions.dc.html` | A7 questions + rubric panel | |
| `SessionReview.dc.html` | A8 session review | |
| `Reports.dc.html` | A9 reports | |
| `Settings.dc.html` | A10 admins | prop `view`: admins, ai, privacy, email, audit |
| `SettingsPrivacy.dc.html` | A10 data and privacy | wraps Settings |

If the spec in `../docs/` and this source disagree on a value or a string, the source is what was approved; flag disagreements about behaviour to the design owner.
