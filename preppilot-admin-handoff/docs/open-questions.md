# Decisions, illustrative data and open questions

## Decisions already made (approved)

- Light palette and band identities exactly as in the brief.
- Dark palette as proposed by design (see `design-system.md`).
- Band chips use ink text + coloured dot on a tint; charts use 2px gaps and direct labels/counts.
- Chip treatments for AI draft (dashed amber on amber-soft), Revoked (gray outline), Deactivated (gray fill).
- Side panel dims the list (`--scrim-panel`, 24%) but keeps it visible.
- Validation problems (invalid email, unknown role, duplicate) are amber, not red.
- Empty states hide the header primary so there's only one primary on screen.
- Row menu shows "Revoke invite" (not "Deactivate") for invite-pending candidates.
- The approve dialog is shown in its enabled state; the disabled "Approve role" with tooltip is the default for Sales Development Rep.
- A6 shows all 5 AI drafts (matching "8 cards, 5 AI drafts"), not 3 as one prompt said.
- A7 is shown on Customer Support Associate, because the sample question belongs to that role.
- Candidate-app pieces (flash card, sub-score bar, band chip, score ring) were drawn to shared tokens because no candidate-app design system was available; replace with the real ones if they exist.

## Illustrative data — replace before treating as real

These numbers/names were invented to fill layouts. They're marked `"source": "illustrative"` in `data/sample-data.json`.

| Where | Illustrative value |
|---|---|
| A1 | Last active: Priya "Today 10:42", Ananya "Yesterday", Rahul "2 days ago" |
| A1 | Saved filter definitions: Not ready yet, No change in 2 sessions, Invite pending |
| A2 | New invitee names (Neha Kapoor, Vikram Rao, Meera Nair, Deepak Joshi, Fatima Sheikh, Rohit Gupta, Sana Khan), file name `october-cohort.csv` |
| A3 | Priya's session dates/durations (3, 10, 15 Oct; 19/22/24 min) and scores 54 → 66 → 78; Ananya's 69 → 88; activity timestamps; max sessions = 5 |
| A4 | Junior Data Analyst average latest score 63; Field Technician counts (10 cards, 12 questions); seniority labels; last-edited dates |
| A5 | SDR description text and key skills |
| A6 | All 8 SDR flash cards' content |
| A7 | CSA question list beyond the upset-customer question; times asked; avg scores except 48 → 69; rubric content; test answer and result |
| A8 | Q1–Q5 first/second scores, transcripts, sub-scores, delivery metrics, learning score 86, flag history |
| A9 | Baseline band split 0 / 3 / 12 / 9; dimension averages 74 / 58 / 70 / 77; times asked and learning for hardest questions; needs-attention candidates (Sneha Reddy, Aditya Rao, Farhan Ali) |
| A10 | Other admins (Kavya Menon, Rohan Das, meera.k@example.com), Arjun as Super admin, voice names, audit events; `[Company]` and reply-to placeholders |

## Open questions

1. **Learning score:** how is it computed? (Session score = 20% first + 55% second + 25% learning.)
2. **Approve requirements:** is "≥ 5 questions with rubrics" the full rule? Also require ≥ N approved flash cards? No unresolved AI drafts?
3. **CSV with a Draft role:** separate message "Role not approved yet", or treat as "Unknown role"?
4. **Access limits for CSV invites:** should "Access until" and "Max sessions per role" also apply to CSV uploads (they're only on the One by one tab now)?
5. **Role overflow:** the "+2" role chip is specified but unused by sample data — confirm max roles per candidate.
6. **Permissions:** confirm Admin vs Super admin capabilities (proposal in `domain-model.md`).
7. **Email:** who sends invites and role-approved emails; invite link expiry (designed as 7 days).
8. **Retention:** what happens to scores when transcripts expire? Does "Candidates can delete their data" also remove them from reports aggregates?
9. **Flag review workflow:** who resolves flags and where (no reviewer screen is designed)?
10. **Reports:** baseline definition when a candidate has multiple roles; date range applies to session date or invite date?
11. **Export PDF (A8):** layout not designed.
12. **Preview tab / Preview as candidate:** not designed; should reuse candidate-app screens.
13. **Error and loading states:** only patterns are designed (skeleton rows, empty states). System error copy needs writing.
14. **Mobile (view-only):** not designed beyond the responsive notes.
15. **Product name:** "PrepPilot" is a working name.
