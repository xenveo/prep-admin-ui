/**
 * Domain types and view models for the PrepPilot admin console.
 * Shapes follow preppilot-admin-handoff/docs/domain-model.md. Values that come from
 * src/data/sample-data.json keep their `source` flag ("brief" | "illustrative").
 */
import type { Band } from "@/lib/bands";

export type { Band };

export type Source = "brief" | "illustrative";

/** Fixed "today" for deterministic relative times (matches sample-data.json). */
export const TODAY = "2026-10-15";
/** Fixed "now" used to timestamp mutations in the mock store. */
export const NOW_ISO = "2026-10-15T11:45:00+05:30";

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type DimensionId = "content" | "structure" | "delivery" | "relevance";
export const DIMENSION_IDS: readonly DimensionId[] = ["content", "structure", "delivery", "relevance"];
export const DIMENSION_LABEL: Record<DimensionId, string> = {
  content: "Content",
  structure: "Structure",
  delivery: "Delivery",
  relevance: "Relevance",
};

export type SubScores = Record<DimensionId, number>;
export type DimensionWeights = Record<DimensionId, number>;
export type SessionWeights = { firstTry: number; secondTry: number; learning: number };

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = { content: 45, structure: 20, delivery: 20, relevance: 15 };
export const DEFAULT_SESSION_WEIGHTS: SessionWeights = { firstTry: 20, secondTry: 55, learning: 25 };

// ---------------------------------------------------------------------------
// Admins, settings, audit
// ---------------------------------------------------------------------------

export type AdminAccess = "admin" | "super_admin";
export type AdminStatus = "invite_pending" | "active";

export type Admin = {
  id: string;
  /** null for a pending invite that has no name yet. */
  name: string | null;
  email: string;
  title?: string;
  access: AdminAccess;
  status: AdminStatus;
  /** ISO date/time, the literal "now" for the signed-in admin, or null (pending). */
  lastActiveAt: string | null;
  invitedAt?: string;
  source?: Source;
};

export type FeedbackLength = "short" | "standard";
export type TranscriptRetention = "6m" | "12m" | "until_removed";

export type WorkspaceSettings = {
  voice: string;
  feedbackLength: FeedbackLength;
  language: "en";
  audioRetentionDays: 7 | 30 | 90;
  transcriptRetention: TranscriptRetention;
  candidatesCanDeleteData: boolean;
  senderName: string;
  replyTo: string;
  inviteLinkExpiryDays: number;
  lastExportAt: string | null;
};

export const VOICE_OPTIONS: readonly string[] = ["Calm, mid-pitch", "Warm, lower pitch", "Bright, higher pitch"];
export const AUDIO_RETENTION_OPTIONS: readonly (7 | 30 | 90)[] = [7, 30, 90];
export const TRANSCRIPT_RETENTION_LABEL: Record<TranscriptRetention, string> = {
  "6m": "6 months",
  "12m": "12 months",
  until_removed: "Until the candidate is removed",
};

export type AuditEvent = {
  id: string;
  actorId: string | null;
  /** Display name of the actor. */
  actor: string;
  action: string;
  itemLabel: string;
  itemRef?: string;
  /** ISO date or date-time. */
  at: string;
  source?: Source;
};

export type AuditFilters = {
  /** Admin id. */
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
};

// ---------------------------------------------------------------------------
// Roles, flash cards, questions
// ---------------------------------------------------------------------------

export type Seniority = "entry" | "junior" | "mid" | "senior";
export const SENIORITY_LABEL: Record<Seniority, string> = {
  entry: "Entry level",
  junior: "Junior",
  mid: "Mid level",
  senior: "Senior",
};
export type RoleStatus = "draft" | "approved" | "archived";

export type RoleSettings = {
  questionsPerSession: number;
  questionOrder: "fixed" | "random";
  answerGuideSeconds: number;
  requireAllCards: boolean;
  /** null = no limit */
  maxSessionsPerCandidate: number | null;
  sessionWeights: SessionWeights;
  dimensionWeights: DimensionWeights;
};

export type JobRole = {
  id: string;
  title: string;
  seniority: Seniority;
  status: RoleStatus;
  /** Sanitised HTML (what RichTextEditor edits). May be empty. */
  description: string;
  keySkills: string[];
  settings: RoleSettings;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
  /** Derived counts (include cards/questions that are still AI drafts). */
  flashCardCount: number;
  questionCount: number;
  /** Flash cards with status ai_draft. */
  aiDraftCardCount: number;
  aiDraftQuestionCount: number;
  candidatesAssigned: number;
  /** null when the role isn't live or is archived. */
  avgLatestScore: number | null;
  avgLatestBand: Band | null;
  source?: Source;
  illustrativeFields?: string[];
};

export type RoleInput = {
  title: string;
  seniority: Seniority;
  description?: string;
  keySkills?: string[];
};

export type RolePatch = Partial<Pick<JobRole, "title" | "seniority" | "description" | "keySkills" | "settings">>;

export type ApproveRequirement = { id: string; label: string; met: boolean };
export type ApproveRequirements = {
  canApprove: boolean;
  /** Text of the first unmet requirement, e.g. "Add at least 5 questions with rubrics". null when all met. */
  firstUnmet: string | null;
  requirements: ApproveRequirement[];
  /** For the approve dialog bullets. */
  approvedFlashCards: number;
  approvedQuestions: number;
  candidatesToNotify: number;
};

export type CardCategory = "behavioural" | "situational" | "role_knowledge" | "motivation";
export const CARD_CATEGORY_LABEL: Record<CardCategory, string> = {
  behavioural: "Behavioural",
  situational: "Situational",
  role_knowledge: "Role knowledge",
  motivation: "Motivation",
};
export const TIP_MAX_LENGTH = 90;

export type FlashCard = {
  id: string;
  roleId: string;
  /** 1-based, contiguous per role. */
  position: number;
  category: CardCategory;
  question: string;
  strongAnswerPoints: string[];
  /** <= 90 chars */
  tip: string;
  commonMistakes: string[];
  status: "ai_draft" | "approved";
  /** "ai" or an admin id */
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
};

/** Input for saveFlashCard: omit `id` to create; position is assigned on create. */
export type FlashCardInput = Omit<FlashCard, "id" | "position" | "status" | "createdBy"> &
  Partial<Pick<FlashCard, "id" | "status">>;

export type Difficulty = "easy" | "medium" | "hard";
export type ExpectedStructure = "star" | "problem_solution" | "free";

export type Rubric = {
  keyPoints: { point: string; example: string }[];
  redFlags: string[];
  expectedStructure: ExpectedStructure;
};

export type TestEvaluation = {
  answer: string;
  score: number;
  band: Band;
  subScores: SubScores;
  matched: string[];
  issues: string[];
  candidateFeedback: string;
  /** Always true: test results are never stored on a candidate. */
  isTest: true;
};

export type Question = {
  id: string;
  roleId: string;
  text: string;
  category: CardCategory;
  difficulty: Difficulty;
  status: "ai_draft" | "approved";
  rubric: Rubric;
  timesAsked: number;
  avgFirstTry: number | null;
  avgSecondTry: number | null;
  avgLearning: number | null;
  /** Sample evaluation from the fixtures (only q1). Not shown unless the admin runs a test. */
  sampleEvaluation?: TestEvaluation;
};

export type QuestionInput = Omit<Question, "id" | "timesAsked" | "avgFirstTry" | "avgSecondTry" | "avgLearning" | "status" | "sampleEvaluation"> &
  Partial<Pick<Question, "id" | "status">>;

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export type CandidateStatus = "invite_pending" | "active" | "deactivated" | "revoked";

export type RoleRef = { id: string; title: string; status: RoleStatus };

/** One row of the A1 table. */
export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  status: CandidateStatus;
  roles: RoleRef[];
  sessions: number;
  latestScore: number | null;
  band: Band | null;
  /** latest - baseline; null when fewer than 2 sessions. */
  change: number | null;
  /** ISO, null if never active. */
  lastActiveAt: string | null;
  /** "Today 10:42", "Yesterday", "2 days ago" or "Not yet". */
  lastActiveLabel: string;
  /** "Invite sent 2 days ago" for invite-pending rows. */
  lastActiveNote?: string;
};

export type CandidateSortColumn = "name" | "status" | "sessions" | "score" | "change" | "lastActive";

export type CandidateQuery = {
  search?: string;
  roleIds?: string[];
  bands?: Band[];
  statuses?: CandidateStatus[];
  /** Active within the last N days. */
  lastActiveWithinDays?: number;
  /** At least N sessions and no improvement (change <= 0). */
  noChangeInSessions?: number;
  /** default { columnId: "lastActive", direction: "desc" } */
  sort?: { columnId: CandidateSortColumn; direction: "asc" | "desc" };
};

export type CandidateList = {
  rows: CandidateRow[];
  /** Rows matching the query. */
  total: number;
  /** All candidates ignoring the query (0 = first-use empty state). */
  totalUnfiltered: number;
};

export type SavedFilter = {
  id: string;
  label: string;
  query: CandidateQuery;
  isDefault?: boolean;
  source?: Source;
};

export type RoleAssignment = {
  roleId: string;
  roleTitle: string;
  roleStatus: RoleStatus;
  assignedAt: string;
  /** null = no limit */
  maxSessions: number | null;
  sessionsUsed: number;
  baselineScore: number | null;
  latestScore: number | null;
  latestBand: Band | null;
  changeSinceBaseline: number | null;
};

export type SessionSummary = {
  id: string;
  candidateId: string;
  roleId: string;
  roleTitle: string;
  number: number;
  /** ISO date or date-time */
  date: string;
  score: number;
  band: Band;
  durationMin: number;
};

export type ActivityItem = { text: string; at: string };

export type ProgressPoint = { label: string; date: string; score: number };

export type CandidateDetail = {
  id: string;
  name: string;
  email: string;
  status: CandidateStatus;
  invitedAt: string;
  invitedBy: string;
  invitedByName: string;
  firstLoginAt?: string;
  lastActiveAt: string | null;
  accessUntil?: string | null;
  assignments: RoleAssignment[];
  /** Newest first. */
  sessions: SessionSummary[];
  /** Newest first. */
  activity: ActivityItem[];
  /** Oldest first, for ProgressLineChart. Scores for all roles combined. */
  progress: ProgressPoint[];
  /** latest - first session across all sessions; null with < 2 sessions. */
  changeSinceFirst: number | null;
  source?: Source;
};

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export type InviteResult =
  | "ready"
  | "already_invited"
  | "invalid_email"
  | "unknown_role"
  | "role_not_approved"
  | "duplicate_in_file";

export const INVITE_RESULT_LABEL: Record<InviteResult, string> = {
  ready: "Ready",
  already_invited: "Already invited",
  invalid_email: "Invalid email",
  unknown_role: "Unknown role",
  role_not_approved: "Role not approved yet",
  duplicate_in_file: "Duplicate in file",
};

export type InviteRowInput = { email: string; name: string; roles: string[] };

export type InviteRow = {
  /** 1-based data row (header excluded). */
  rowNumber: number;
  email: string;
  name: string;
  /** Role names as typed. */
  roles: string[];
  result: InviteResult;
  /** Which cell is the problem: for amber 600 styling. */
  problemCell?: "email" | "roles";
  /** The unmatched role name when result is unknown_role / role_not_approved. */
  badRole?: string;
};

export type InviteSummary = { total: number; ready: number; needFixing: number };

export type InviteCsvParse = {
  rows: InviteRow[];
  summary: InviteSummary;
  /** Required headers missing from the file (email, name, roles). Empty when OK. */
  missingColumns: string[];
};

export type InviteBatchInput = {
  source: "single" | "csv";
  fileName?: string;
  /** Rows to invite; any that fail validation at send time are skipped. */
  rows: { email: string; name: string; roleIds: string[] }[];
  accessUntil?: string | null;
  maxSessions?: number | null;
};

export type InviteBatchResult = {
  batchId: string;
  sent: number;
  skipped: number;
  candidateIds: string[];
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type Highlight = { text: string; kind: "match" | "issue"; note: string };
export type AppliedState = "done" | "partial" | "missed";

export type DeliveryMetrics = { wpm: number; paceLabel?: string; fillerWords: number; longestPauseSec: number };

export type Try = {
  attempt: 1 | 2;
  score: number;
  band: Band;
  audioSeconds: number;
  /** "1:38" */
  audioLabel: string;
  subScores: SubScores;
  transcript: string;
  highlights: Highlight[];
  worked: string;
  improve: string;
  delivery: DeliveryMetrics;
  /** Second try only. */
  appliedFromFeedback?: { text: string; state: AppliedState; detail?: string }[];
};

export type SessionQuestion = {
  /** 1-based position */
  n: number;
  text: string;
  category?: CardCategory;
  firstScore: number;
  secondScore: number;
  /** Present only where the fixtures have full detail (Q2 of Priya's session 3). */
  tries?: [Try, Try];
};

export type FlagDimension = DimensionId | "overall" | "feedback";
export type FlagIssue = "too_high" | "too_low" | "feedback_inaccurate" | "transcript_wrong";
export const FLAG_ISSUE_LABEL: Record<FlagIssue, string> = {
  too_high: "Score is too high",
  too_low: "Score is too low",
  feedback_inaccurate: "Feedback is inaccurate",
  transcript_wrong: "Transcript is wrong",
};
export const FLAG_DIMENSION_LABEL: Record<FlagDimension, string> = {
  ...DIMENSION_LABEL,
  overall: "Overall",
  feedback: "Feedback",
};

export type EvaluationFlag = {
  id: string;
  sessionId: string;
  /** "Session 2 · Q4 · Delivery" */
  title: string;
  questionNumber: number;
  dimension: FlagDimension;
  issue?: FlagIssue;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: "open" | "resolved";
  /** e.g. "score adjusted 58 → 64" */
  resolution?: string;
};

export type FlagInput = {
  sessionId: string;
  questionNumber: number;
  dimension: FlagDimension;
  issue: FlagIssue;
  note?: string;
};

export type SessionReview = {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  roleId: string;
  roleTitle: string;
  sessionNumber: number;
  date: string;
  durationMin: number;
  score: number;
  band: Band;
  /** Points vs the previous session, null for the first. */
  changeVsPrevious: number | null;
  /** null when the fixtures have no detail for this session. */
  firstTryAvg: number | null;
  secondTryAvg: number | null;
  learningScore: number | null;
  /** False when only the summary exists; questions is then empty. */
  hasDetail: boolean;
  questions: SessionQuestion[];
  weights: SessionWeights;
  /** "20% first try + 55% second try + 25% learning = 78" */
  formulaText: string;
  source?: Source;
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type BandCounts = Record<Band, number>;

export type ReportQuery = { roleId: string; from?: string; to?: string };

export type HardestQuestion = {
  questionId?: string;
  question: string;
  timesAsked: number;
  avgFirst: number;
  avgSecond: number;
  avgLearning: number | null;
};

export type NeedsAttention = {
  /** Present when the person exists in the candidate store (Open can show the A3 panel). */
  candidateId?: string;
  name: string;
  email: string;
  why: string;
  sessions: number;
  latestScore: number | null;
  lastActiveLabel: string;
  lastActiveAt?: string;
};

export type Report = {
  roleId: string;
  roleTitle: string;
  range: { from: string; to: string; label: string };
  /** False when the role has no report data (draft/archived or not enough sessions). */
  hasData: boolean;
  stats: {
    invited: number;
    active: number;
    completedSession: number;
    avgBaseline: number | null;
    avgLatest: number | null;
    /** avgLatest - avgBaseline */
    change: number | null;
  };
  bandsLatest: BandCounts;
  bandsBaseline: BandCounts;
  hardestQuestions: HardestQuestion[];
  dimensionAverages: Record<DimensionId, number> | null;
  /** Computed from dimensionAverages (lowest value). */
  weakest: { id: DimensionId; label: string; value: number } | null;
  /** "Structure is the weakest area. Consider a flash card on STAR." */
  weakestNote: string | null;
  needsAttention: NeedsAttention[];
  /** Which parts are illustrative. */
  illustrative: string[];
};

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export type CsvExport = { filename: string; csv: string };
