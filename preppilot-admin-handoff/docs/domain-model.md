# Domain model

A UI-driven sketch, not a final schema. It covers every field the screens display. Backend owners should confirm names, types and ownership.

## Entities

### Admin
`id, name, email, title (e.g. "Recruitment trainer"), access: 'admin' | 'super_admin', status: 'invite_pending' | 'active', lastActiveAt`

### Candidate
`id, name, email, status: 'invite_pending' | 'active' | 'deactivated' | 'revoked', invitedAt, invitedBy (Admin), firstLoginAt?, lastActiveAt?, accessUntil?`
- **Revoked** = invite withdrawn before first login. **Deactivated** = account turned off after activation. Both keep history.

### RoleAssignment
`candidateId, roleId, assignedAt, maxSessions? (null = no limit), sessionsUsed`
- Derived per assignment: `baselineScore` (first session), `latestScore`, `latestBand`, `changeSinceBaseline = latest − baseline` (null if < 2 sessions).

### JobRole
`id, title, seniority: 'entry' | 'junior' | 'mid' | 'senior', descriptionRichText, keySkills[], status: 'draft' | 'approved' | 'archived', settings (RoleSettings), updatedAt, updatedBy`
- Candidates see a role only when it's **approved** and **assigned** to them.

### RoleSettings
`questionsPerSession (5), questionOrder: 'fixed' | 'random', answerGuideSeconds (120), requireAllCards (true), maxSessionsPerCandidate (5 | null), sessionWeights { firstTry 20, secondTry 55, learning 25 }, dimensionWeights { content 45, structure 20, delivery 20, relevance 15 }`
- Each weight group must total 100.

### FlashCard
`id, roleId, position, category: 'behavioural' | 'situational' | 'role_knowledge' | 'motivation', question, strongAnswerPoints[], tip (≤90 chars), commonMistakes[], status: 'ai_draft' | 'approved', createdBy: 'ai' | adminId, approvedBy?, approvedAt?`

### Question
`id, roleId, text, category, difficulty: 'easy' | 'medium' | 'hard', status: 'ai_draft' | 'approved', rubric (Rubric)`
- Derived: `timesAsked, avgFirstTry, avgSecondTry, avgLearning`.

### Rubric
`keyPoints [{ point, example }], redFlags[], expectedStructure: 'star' | 'problem_solution' | 'free'`

### Session
`id, candidateId, roleId, number (1..n), startedAt, durationSeconds, answers[5], firstTryAvg, secondTryAvg, learningScore, score (0–100), band`

### Answer (one per question per session)
`questionId, position (1–5), tries: [Try, Try]`

### Try
`attempt: 1 | 2, audioUrl, durationSeconds, transcript, highlights [{ start, end, kind: 'match' | 'issue', note, rubricPointId? }], subScores { content, structure, delivery, relevance }, score, feedback { worked, improve }, delivery { wpm, fillerWords, longestPauseSeconds }, appliedFromFeedback? [{ text, state: 'done' | 'partial' | 'missed' }]` (second try only)

### EvaluationFlag
`id, sessionId, questionId, dimension: 'content' | 'structure' | 'delivery' | 'relevance' | 'overall' | 'feedback', issue: 'too_high' | 'too_low' | 'feedback_inaccurate' | 'transcript_wrong', note, createdBy, createdAt, status: 'open' | 'resolved', resolution? (e.g. "score adjusted 58 → 64")`
- A flag never changes scores by itself.

### Invite (batch)
`id, createdBy, createdAt, source: 'single' | 'csv', fileName?, rows [{ rowNumber, email, name, roles[], result: 'ready' | 'already_invited' | 'invalid_email' | 'unknown_role' | 'role_not_approved' | 'duplicate_in_file' }]`

### WorkspaceSettings
`voice, feedbackLength: 'short' | 'standard', language: 'en' (locked), audioRetentionDays (7 | 30 | 90; default 30), transcriptRetention ('6m' | '12m' | 'until_removed'), candidatesCanDeleteData (true), senderName, replyTo, lastExportAt?`

### AuditEvent
`id, actorId, action, itemLabel, itemRef, at`

## Scoring

- **Answer score** = Σ(dimension sub-score × dimension weight). Defaults: Content 45%, Structure 20%, Delivery 20%, Relevance 15%.
  - Example (A8 Q2 first try): 52×.45 + 40×.20 + 58×.20 + 60×.15 = 52.
- **Session score** = firstTryAvg × 20% + secondTryAvg × 55% + learningScore × 25%, rounded to an integer.
  - Example (A8): 62×.20 + 80×.55 + 86×.25 = 77.9 → **78**.
- **Learning score:** not defined in the brief. Likely measures how well the second try applied the first try's feedback (see "Applied from feedback"). **Open question** for the scoring owner.
- **Bands:** 85–100 Interview ready · 70–84 Nearly ready · 50–69 Developing · 0–49 Not ready yet.
- **Baseline** = a candidate's first session score for that role. **Change** = latest − baseline.

## Lifecycles

- **Role:** Draft → (approve, requires ≥ 5 questions with rubrics + all weight groups = 100) → Approved → (archive, confirms) → Archived. Approving notifies assigned candidates by email.
- **AI content:** generated as `ai_draft` → admin approves (→ `approved`) or discards (deleted). Drafts are never shown to candidates, even on an approved role.
- **Candidate:** invite_pending → (first login) active → (deactivate) deactivated → (reactivate) active. invite_pending → (revoke) revoked.
- **Flag:** open → resolved (with resolution note).

## Permissions (proposed)

| Capability | Admin | Super admin |
|---|---|---|
| Candidates, roles, content, reports, session review, flags | ✓ | ✓ |
| Settings › AI and voice | ✓ | ✓ |
| Settings › Admins, Data and privacy, Email | – | ✓ |
| Audit log | read | read |

## Reports metrics (per role, date range)

`invited, active, completedSession, avgBaseline, avgLatest, change, bandCounts { latest[4], baseline[4] }, hardestQuestions [{ question, timesAsked, avgFirst, avgSecond, avgLearning }] (lowest avg first try), dimensionAverages[4], needsAttention [{ candidate, reason, sessions, latestScore, lastActiveAt }]` where "needs attention" = latest < 50 **or** no activity for 14 days.
