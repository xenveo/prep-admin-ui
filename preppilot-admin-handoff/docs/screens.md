# Screen specs (A1–A10)

Each section lists: suggested route, source artboards, layout, states, behaviour, copy and acceptance criteria. Data comes from `../data/sample-data.json`. Components are defined in `components.md`; keyboard and ARIA rules in `interaction-and-a11y.md`.

Suggested routes (adapt to your router):

| Screen | Route |
|---|---|
| A1 Candidates | `/candidates` |
| A2 Invite modal | `/candidates?invite=one` · `?invite=csv` (or local state) |
| A3 Candidate panel | `/candidates?candidate=:id` (deep-linkable) |
| A4 Job roles | `/roles` · `/roles?tab=archived` |
| A5–A7 Role editor | `/roles/:roleId/{details,cards,questions,settings,preview}` |
| A8 Session review | `/candidates/:candidateId/sessions/:sessionId?q=2` |
| A9 Reports | `/reports?role=:roleId&from=&to=` |
| A10 Settings | `/settings/{admins,ai,privacy,email,audit}` |

---

## A1 · Candidates

**Source:** `Candidates.dc.html` (views `default`, `plain`, `selected`, `noresults`, `empty`, `panel-priya`, `panel-karan`), wrappers `CandidatesSelected`, `CandidatesNoResults`, `CandidatesEmpty`.

**Header:** title "Candidates", description "Invite people and track how prepared they are.", primary "Invite candidates" (opens A2). Hidden in the empty state.

**Filter bar:** search "Search name or email" · Role (multi-select) · Band · Status (Invite pending, Active, Deactivated) · "Last active: Any time" (range) · when filters are active they render as removable pills plus "Clear filters".

**Saved filters row:** label "Saved filters" + chips: All candidates (default, pressed), Not ready yet, No change in 2 sessions, Invite pending · "+ Save current filters". The last three chip definitions were proposed by design; confirm them.

**Table toolbar:** left "4 candidates", right "Sorted by last active". Replaced by the bulk bar when rows are selected.

**Columns:**

| # | Column | Content | Align | Sortable |
|---|---|---|---|---|
| 1 | (select) | checkbox, header checkbox supports mixed | centre | – |
| 2 | Name | initials avatar + name (600) + email (12px muted) | left | yes |
| 3 | Roles | first role chip (neutral) + "+N" overflow chip; a role that is still Draft renders as "Role name · Draft" with amber outline and a tooltip "This role is still a draft, so the candidate cannot see it yet" | left | – |
| 4 | Status | `StatusChip` | left | yes |
| 5 | Sessions | integer | right | yes |
| 6 | Latest score | `ScoreCell` | left (number right-aligned) | yes |
| 7 | Since baseline | `ChangeValue` (header tooltip "Change since baseline") | right | yes |
| 8 | Last active | relative time; invite-pending shows "Not yet" + "Invite sent 2 days ago" | left | yes (default, descending) |
| 9 | (actions) | ⋯ on hover/focus | centre | – |

**Row menu:** Resend invite (enabled only for Invite pending; otherwise disabled with title "Already active") · Assign roles · divider · Deactivate (Active) **or** Revoke invite (Invite pending), both in `--error` and both confirm.

**Bulk bar (≥1 selected):** "N selected" · Clear · Assign roles · Resend invites (count of pending rows among the selection; disabled at 0) · Export CSV · Deactivate (right, `--error`, confirms with names).

**States to build:**

1. **Default** with the four sample candidates (Priya, Ananya, Rahul, Karan), sorted by last active.
2. **Row hover** with ⋯ visible; **menu open** on Karan's row (menus near the bottom open upward).
3. **Bulk selected:** Rahul and Karan selected, header checkbox mixed, "Resend invites (1)".
4. **Filtered, no results:** filters Role: Junior Data Analyst + Band: Interview ready → table body shows "No candidates match these filters." with a secondary "Clear filters" button.
5. **First-use empty:** no filter bar, no table; empty state "Invite your first candidates" / "They'll get an email with a login link." / primary "Invite candidates" / helper "Add one email or upload a CSV. Candidates only see job roles you've approved."
6. **Loading:** skeleton rows (not drawn on canvas; use the component sheet pattern).
7. **Error:** inline banner above the table "Couldn't load candidates. Try again." with a retry button (not drawn; follow tokens).

**Behaviour:** clicking a row or pressing Enter opens A3; checkbox and ⋯ clicks don't open the panel. Search filters as you type (debounced). Filters and sort persist in the URL.

**Acceptance:**
- [ ] Every column, chip and copy string matches the table above.
- [ ] Header primary is hidden in the empty state; no screen shows two primary buttons in the header.
- [ ] Keyboard grid behaviour per `interaction-and-a11y.md`.
- [ ] Deactivate / Revoke confirm with the exact copy pattern; bulk confirm lists names and pending-invite count.

---

## A2 · Invite candidates modal

**Source:** `InviteModal.dc.html` (views `one`, `csv`, `validate`), `InviteCsv`, `InviteValidate`, `InviteSuccess`.

640px modal over the dimmed Candidates page. Title "Invite candidates", close (×). Tabs: **One by one** · **Upload CSV**.

### One by one
- **People:** rows of Email + Name + remove; "Add another" adds a row. Live validation per row:
  - duplicate → amber border on the email + message "Already invited. [First name] is active, so this row will be skipped."
  - invalid email → amber message "Enter a valid email" (not drawn; same pattern).
- **Assign roles:** `RoleChecklist`. Helper "Candidates see only approved roles. Pick one or more." Approved roles selectable with meta "12 cards · 15 questions" / "12 cards · 18 questions"; Sales Development Rep disabled with Draft chip and "Approve this role first" link (to the role editor); archived roles hidden.
- **Access until (optional):** date input, placeholder "No end date", helper "They can't log in after this date."
- **Max sessions per role (optional):** number, placeholder "No limit", helper "Mock interviews each person can take per role."
- **Footer:** note "1 already invited, will be skipped" · Cancel · primary "Send 1 invite" (count = valid, non-duplicate rows; disabled at 0; label pluralises).

### Upload CSV — before upload
`DropZone` "Drop a CSV or browse", helper "One person per row. Separate multiple roles with a semicolon." · "Download template" link (columns: `email, name, roles`) · helper "Role names must match an approved job role: Customer Support Associate, Junior Data Analyst." · footer note "Nothing is sent until you confirm" · Cancel · disabled "Send invites".

### Upload CSV — validated
- File row: file icon, "october-cohort.csv", "45 rows · checked just now", "Replace file".
- Summary (live region): "✓ 42 ready" (teal) · "3 need fixing" (amber). Segmented "All 45 | Need fixing 3".
- Preview table (Row #, Email, Name, Roles, Check), problem rows first on an amber tint, offending cell in amber 600:
  - Row 3 priya.sharma@example.com → "Already invited"
  - Row 17 rohit.gupta@example → "Invalid email"
  - Row 29 role "Customer Success Lead" → "Unknown role"
  - Valid rows → teal check "Ready"; then "37 more ready rows".
- Helper "Rows that need fixing are skipped. Fix them in the file and upload it again, or send now and add them later."
- Footer: "3 rows will be skipped" · Cancel · primary "Send 42 invites".
- **Open:** a CSV naming a Draft role should probably get its own message "Role not approved yet". Confirm with design.

### Success
Modal closes; toast bottom-left: "42 invites sent" / "Each person gets an email with a login link. 3 rows were skipped." / link "Show invite pending" (applies the Invite pending saved filter) / dismiss.

**Acceptance:**
- [ ] CSV parsing handles header row, quoted values, semicolon-separated roles, trailing whitespace, case-insensitive role matching, duplicate emails within the file (flag as "Duplicate in file").
- [ ] Send button count always equals the ready rows.
- [ ] Focus is trapped; Esc closes; closing with unsent data asks "Discard these invites?" (not drawn; use `ConfirmDialog`, default tone).

---

## A3 · Candidate side panel

**Source:** `CandidatePanel.dc.html` (prop `cid`), shown in `CandidatesPanelPriya` and `CandidatesPanelKaran`.

560px panel over the dimmed Candidates list.

**Header:** avatar (40px), name (16/600), status chip, email; ⋯ menu and close (×).
- Active candidate menu: Resend invite (disabled) · Deactivate.
- Invite-pending menu: Resend invite · Revoke invite.

**Invite-pending banner (Karan):** amber-soft box with mail icon: "Invited 2 days ago, not yet logged in." + "Resend invite" button.

**Sections (scroll):**

1. **Roles** + "Assign role" button. Per role: name; band chip + latest score; "Sessions used 3 of 5"; "Remove" (red text, confirms). Draft role (Karan): Draft chip + "Not visible to the candidate until you approve this role."
2. **Progress** (only with ≥1 session): change line ("+24 since first session" teal; with one session "Baseline only. Change shows after the second session."); `ProgressLineChart` with thresholds; "Show as table" toggle.
3. **Sessions** table: Date, Role, Score, Band, Duration, chevron. Each row links to A8.
4. **Activity** (newest first): e.g. "Completed session 3 · 78 Nearly ready — 15 Oct, 10:42", "Studied 12 of 12 flash cards", "First login", "Invited by Arjun Mehta".

No sessions: section "Progress and sessions" with "No sessions yet. Scores and the progress chart appear after the first mock interview."

**Confirm copy (exact pattern):**
- Deactivate: "Deactivate Priya Sharma?" / "Priya won't be able to log in or start sessions. Their 3 sessions, scores and transcripts are kept, and you can reactivate them later." / Cancel · Deactivate.
- Revoke: "Revoke Karan Singh's invite?" / "The login link in Karan's email stops working and they won't be able to sign in. Nothing else changes, and you can invite them again later." / Cancel · Revoke invite.
- Remove role: "Remove Customer Support Associate from Priya Sharma?" / "Priya loses access to this role's flash cards and mock interviews. Their 3 past sessions stay in reports, and you can assign the role again later." / Cancel · Remove role.

**Acceptance:**
- [ ] Opening via click or Enter; ↑ ↓ on the list switch the panel's candidate; Esc closes (menu → confirm → panel, innermost first) and focus returns to the row.
- [ ] Panel URL is deep-linkable.

---

## A4 · Job roles

**Source:** `JobRoles.dc.html` (views `active`, `archived`, `empty`), `JobRolesEmpty`.

**Header:** "Job roles" / "Candidates only see roles you approve and assign to them." / primary "New job role" (hidden when empty).

**Tabs:** Active (3) · Archived (1), plus a "Search roles" input on the right.

**Columns:** Role (title 600 + seniority meta; sorted ascending) · Status chip · Flash cards (right) · Questions (right) · AI drafts (`ReviewBadge` "5 to review" linking to the cards tab, else "–") · Candidates (right) · Avg latest score (`ScoreCell`, or "–" + "Not live yet" / "Archived") · Last edited (date + editor name).

**Rows:** Customer Support Associate (Approved, 12, 15, –, 38, 71 Nearly ready) · Junior Data Analyst (Approved, 12, 18, –, 21, 63 Developing — illustrative score) · Sales Development Rep (Draft, 8, 10, 5 to review, 12, – Not live yet) · Archived tab: Field Technician (Archived).

**Empty:** "Create your first job role" / "You can write the content yourself or have AI draft it for you to review." / primary "New job role".

**Acceptance:** rows open the role editor (click or Enter); keyboard grid; archived roles never appear in role pickers elsewhere.

---

## A5 · Role editor: Details and Settings

**Source:** `RoleEditor.dc.html` (views `details`, `settings`, `approve`), `RoleEditorSettings`, `RoleEditorApprove`.

Full page. Breadcrumb "Job roles / Sales Development Rep". Title + Draft chip; meta "Entry level · 12 candidates assigned · edited today, 09:15 by Arjun Mehta". Actions: secondary "Preview as candidate" · primary "Approve role".

**Approve gating:** while requirements are unmet, "Approve role" is `aria-disabled` with tooltip "Add at least 5 questions with rubrics". (Generalise: show the first unmet requirement.)

**Tabs (routes):** Details · Flash cards 8 (+ "5 to review" badge) · Questions 10 · Settings · Preview.

### Details
- Left card: Role title (input) + Seniority (select: Entry level, Junior, Mid level, Senior); Description (`RichTextEditor`, helper "What the job involves. AI uses this to draft flash cards and questions."); Key skills (`TagInput`: Prospecting, Cold calling, Objection handling, Active listening, CRM hygiene).
- Right card "Draft content with AI" (AI chip): "AI will draft flash cards and questions from this description. Nothing is shown to candidates until you approve it." · secondary-teal "Draft with AI" · "Last draft, today 09:10" · link "5 flash cards waiting for review".
- Autosave with a quiet "Saved" indicator (not drawn).

### Settings
- **Mock interview:** Questions per session (5) · Question order (Fixed | Random) · Answer guide (2:00, min:sec, "Suggested length shown while answering") · Require all flash cards first (switch on) · Max sessions per candidate (5, blank = no limit).
- **Scoring:** `WeightBar` "Session score" (First try 20, Second try 55, Learning 25) and "Answer dimensions" (Content 45, Structure 20, Delivery 20, Relevance 15). Each shows "Total 100%" or the amber error and blocks saving.

### Approve dialog
"Approve Sales Development Rep?" / "12 assigned candidates will see it on their dashboard and get an email." / bullets: "8 approved flash cards and 10 questions go live." · "Content still marked AI draft stays hidden until you approve it." · "You can archive the role later; scores are kept." / Cancel · primary "Approve and notify".

**Acceptance:** weights must total 100 before save; approving moves status Draft → Approved and triggers notifications (backend); AI drafts remain hidden.

---

## A6 · Flash cards tab

**Source:** `RoleCards.dc.html`.

Three columns: card list (320px) · editor (flex) · candidate preview (300px).

- **List:** "8 cards" + "Shown to candidates in this order". Each item: drag handle, number, truncated question, status chip (Approved / AI draft), category. Selected item: `--primary-tint` + 3px teal inset bar. Footer: "+ Add card" · "Draft more with AI".
- **Editor:** "Card 4" + AI draft chip. Category (radio chips: Behavioural, Situational, Role knowledge, Motivation) · Question (textarea) · "What a strong answer includes" (`BulletListEditor`, teal dots) · "Common mistakes" (amber dots) · Tip (one line, max 90 chars).
- **AI draft footer:** "AI draft from the role description. Candidates won't see it until you approve it." · Discard (red text, confirms: "Discard this AI draft?" / "The card is deleted and never shown to candidates. This can't be undone, but you can draft more with AI later." / Discard card) · primary "Approve card".
- Approved card footer: "Approved. Changes save automatically and show to candidates once the role is approved."
- **Preview:** live `FlashCardPreview` front and back.

**Sample:** 3 approved + 5 AI drafts; card 4 selected ("A prospect says "Just send me an email." What do you do next?").

**Acceptance:** reorder by drag and by keyboard (handle + ↑ ↓, focus follows, position announced); approving updates the tab badge count; preview updates as you type.

---

## A7 · Questions and rubrics tab

**Source:** `RoleQuestions.dc.html`. Shown on Customer Support Associate (Approved) because the sample question belongs to it.

- Header like A5 but Approved chip and no primary (secondary "Preview as candidate" only).
- Table toolbar: "15 questions · 5 asked per session · showing 8" · "+ Add question" · "Draft more with AI".
- **Columns:** Question (truncated) · Category · Difficulty (3-step bar glyph + label) · Status chip · Times asked (right) · Avg first → second (right, "48 → 69"; sorted ascending by first try).
- Selecting a row opens a 560px **side panel editor** over the dimmed table:
  - Question textarea · Category select · Difficulty segmented (Easy/Medium/Hard).
  - **Rubric:** Key points, each with an example ("Acknowledges how the customer feels — Example: "I let her explain everything before I said anything."" etc.) + "+ Add key point"; Red flags list; Expected structure segmented (STAR | Problem-solution | Free).
  - **Test this question:** "Type a sample answer to check the rubric. Test results aren't saved to any candidate." · Sample answer textarea · secondary "Run AI evaluation".
  - **Result:** score 74 + Nearly ready chip + "Test result" badge; sub-scores Content 78 (45%), Structure 70 (20%), Delivery 66 (20%), Relevance 80 (15%); evidence transcript with teal matches and amber issue; "Matched: acknowledges feelings, takes ownership, concrete steps" / "Issue: outcome is vague and there's no follow-up"; "Candidate sees this feedback" box.
  - Footer: Close · primary "Save changes".

**Acceptance:** keyboard grid with Enter to open, Esc to close and refocus the row; ↑ ↓ switch the open question; test evaluation never writes to a candidate record.

---

## A8 · Session review

**Source:** `SessionReview.dc.html`. Sidebar collapsed.

- Breadcrumb "Candidates / Priya Sharma / Session 3".
- Header: `ScoreRing` 78 · "Priya Sharma · Session 3" · Nearly ready chip · "+12 vs session 2" · meta "Customer Support Associate · 15 Oct 2026, 10:42 · 24 min" · secondary "Export PDF" (no primary).
- **Stat strip:** First try avg 62 · Second try avg 80 · Learning score 86 · "Session score: 20% first try + 55% second try + 25% learning = 78".
- **Left (232px):** questions 1–5, each with short title and "first → second" (Q2 "52 → 74"). Selected = tint + inset bar. ↑ ↓ moves selection.
- **Main:** "Question 2 of 5 · Behavioural · 52 → 74", question title, highlight legend, two cards side by side:
  - **First try (52, Developing):** audio player + waveform "1:38", transcript with matches ("I said sorry", "Then I checked the order") and issues ("it was the courier's fault, so I told her that." = red flag blame; "I think it was fine in the end." = vague outcome), sub-scores 52/40/58/60, What worked / What to improve, Delivery table (Pace 168 wpm, fast · Filler words 9 · Longest pause 4 s).
  - **Second try (74, Nearly ready):** same, sub-scores 76/68/72/80, plus "Applied from feedback" checklist (✓ Didn't blame another team · ✓ Used STAR structure · ✓ Ended with a clear result · – Slowed down, partly, 142 wpm); Delivery 142 wpm · 3 · 2 s.
- **Right rail (280px):** "Flag this evaluation" form — helper "If the AI scored question 2 wrongly, tell us. The score stays as is until someone reviews it." · Dimension select · What's wrong radios (Score is too high / too low / Feedback is inaccurate / Transcript is wrong) · Note · primary "Submit flag" → status message "Flag added to history. Nothing changes for Priya until it's reviewed." · **Flag history** list with Open/Resolved chips.

**Acceptance:** audio player is fully keyboard-operable; transcripts are real text (selectable, screen-reader readable) with highlight meaning exposed via `title`/visually hidden labels; submitting a flag never changes scores directly.

---

## A9 · Reports

**Source:** `Reports.dc.html`.

- Header "Reports" / "How prepared candidates are, and where they get stuck." / secondary "Export CSV".
- Toolbar: Role select (default Customer Support Associate) · date range "Last 30 days · 15 Sep – 15 Oct 2026".
- **Stat strip (plain numbers):** Invited 38 · Active 31 · Completed a session 24 · Average baseline 52 · Average latest 71 · Change +19 (teal).
- **Preparedness bands:** two `StackedBandBar`s — Latest (6 / 9 / 7 / 2) and Baseline (illustrative 0 / 3 / 12 / 9) + legend; "Show as table" → Band, Baseline, Latest, Change.
- **Hardest questions** table: Question · Times asked · Avg first · Avg second · Learning · "Improve flash card" link. First row "Tell me about a time you handled an upset customer." 48 → 69.
- **Answer dimensions:** `HorizontalBars` Content 74 · Structure 58 (amber, weakest) · Delivery 70 · Relevance 77 (illustrative) + table toggle + amber note "Structure is the weakest area. Consider a flash card on STAR." with "Add a flash card" link.
- **Candidates needing attention** (latest < 50 or no activity for 14 days): Name/email · Why · Sessions · Latest score · Last active · "Open" (opens A3 panel).

**Acceptance:** every chart has a working table toggle; the weakest dimension is computed, not hard-coded; Export CSV exports the current role and date range.

---

## A10 · Settings

**Source:** `Settings.dc.html` (views `admins`, `ai`, `privacy`, `email`, `audit`), `SettingsPrivacy`.

Left subnav (200px): Admins · AI and voice · Data and privacy · Email · Audit log. Header description changes per section. Header primary: "Invite admin" on Admins, "Save changes" on AI and voice / Data and privacy / Email, none on Audit log.

- **Admins:** table Name (avatar, name, email) · Access (Admin / Super admin; pending invite chip) · Last active · ⋯ (Change access, Resend invite, Remove admin → confirm). Helper "Super admins also manage admins, data and privacy, and email settings."
- **AI and voice:** Interviewer voice select + "Play sample" · Feedback length (Short | Standard) · Language "English" locked with lock icon and "the only language for now".
- **Data and privacy:** Keep audio recordings for (7 / 30 default / 90 days; "Audio is deleted automatically after this. Transcripts and scores are kept.") · Keep transcripts for (6 months / 12 months / Until the candidate is removed) · Candidates can delete their data (switch, on) · Data export: "Export all data" + "Last export: never".
- **Email:** Sender name, Reply-to address, invite email preview (subject "You're invited to practise for your interview", body, "Log in to start" button, "This link is just for you. It expires in 7 days.").
- **Audit log:** filters Who / Action / date range; table Who · Action · Item · When.

**Acceptance:** shortening a retention period confirms first ("Shorten audio retention to 7 days? Recordings older than 7 days are deleted tonight and can't be recovered."); only Super admins can see Admins, Data and privacy and Email (others get read-only or hidden — confirm).

---

## Shared component sheet

`Components.dc.html` / `ComponentsDark.dc.html` show every component above in light and dark: sidebar (expanded/collapsed/active/hover/focus), page header, filter bar, table states (default, hover, selected, focus, sort, loading skeleton, empty) with bulk bar, status and band chips, score + change cells, side panel, modal, default and destructive confirmations, tabs, rich text, bullet editor, tag input, weight bar, waveform, evidence highlights, stacked band bar, line chart with thresholds, toast, empty state, and candidate-app pieces (flash card, sub-score bars, band chip, score ring).
