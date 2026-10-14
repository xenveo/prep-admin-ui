/**
 * Typed view of src/data/sample-data.json. Only the services import this file;
 * components never touch fixtures directly.
 */
import raw from "@/data/sample-data.json";
import type { SubScores } from "@/lib/types";

type Src = { source?: string; illustrativeFields?: string[] };

export type FxAdmin = Src & {
  id: string;
  name: string | null;
  title?: string;
  email: string;
  access: "admin" | "super_admin";
  status: "invite_pending" | "active";
  lastActive?: string;
  invitedAt?: string;
};

export type FxRole = Src & {
  id: string;
  title: string;
  seniority: "entry" | "junior" | "mid" | "senior";
  status: "draft" | "approved" | "archived";
  flashCards: number;
  questions: number;
  aiDraftsToReview?: number;
  questionDraftsToReview?: number;
  candidatesAssigned: number;
  avgLatestScore: number | null;
  updatedAt: string;
  updatedBy?: string;
  description?: { text: string; bullets: string[] };
  keySkills?: string[];
  settings?: {
    questionsPerSession: number;
    questionOrder: "fixed" | "random";
    answerGuideSeconds: number;
    requireAllCards: boolean;
    maxSessionsPerCandidate: number | null;
    sessionWeights: { firstTry: number; secondTry: number; learning: number };
    dimensionWeights: SubScores;
  };
};

export type FxCandidate = Src & {
  id: string;
  name: string;
  email: string;
  status: "invite_pending" | "active" | "deactivated" | "revoked";
  roles: string[];
  sessions: number;
  invitedAt?: string;
  firstLoginAt?: string;
  lastActive: string | null;
  sessionsUsed?: string;
  sessionHistory?: { id: string; number: number; date: string; score: number; band: string; durationMin: number }[];
  activity?: [string, string][];
};

export type FxCard = {
  id: string;
  status: "ai_draft" | "approved";
  category: "behavioural" | "situational" | "role_knowledge" | "motivation";
  question: string;
  strong: string[];
  tip: string;
  mistakes: string[];
};

export type FxQuestion = {
  id: string;
  text: string;
  category: "behavioural" | "situational" | "role_knowledge" | "motivation";
  difficulty: "easy" | "medium" | "hard";
  status: "ai_draft" | "approved";
  timesAsked: number;
  avgFirst: number;
  avgSecond: number;
  avgLearning: number;
  rubric?: {
    keyPoints: { point: string; example: string }[];
    redFlags: string[];
    expectedStructure: "star" | "problem_solution" | "free";
  };
  testEvaluation?: {
    answer: string;
    score: number;
    band: string;
    subScores: SubScores;
    matched: string[];
    issues: string[];
    candidateFeedback: string;
  };
};

export type FxTry = {
  attempt: 1 | 2;
  score: number;
  band: string;
  audio: string;
  subScores: SubScores;
  transcript: string;
  highlights: { text: string; kind: "match" | "issue"; note: string }[];
  worked: string;
  improve: string;
  delivery: { wpm: number; paceLabel?: string; fillerWords: number; longestPauseSec: number };
  appliedFromFeedback?: { text: string; state: "done" | "partial" | "missed"; detail?: string }[];
};

export type FxReview = {
  source: string;
  candidate: string;
  role: string;
  date: string;
  durationMin: number;
  score: number;
  band: string;
  changeVsPrevious: number | null;
  firstTryAvg: number;
  secondTryAvg: number;
  learningScore: number;
  questions: { n: number; text: string; first: number; second: number }[];
  question2: { tries: FxTry[] };
  flags: { title: string; note: string; by: string; date: string; status: "open" | "resolved"; resolution?: string }[];
};

export type FxReport = {
  range: { from: string; to: string; label: string };
  stats: { invited: number; active: number; completedSession: number; avgBaseline: number; avgLatest: number; change: number };
  bandsLatest: { ready: number; nearly: number; developing: number; not_ready: number };
  bandsBaseline: { ready: number; nearly: number; developing: number; not_ready: number };
  hardestQuestions: {
    question: string;
    timesAsked: number;
    avgFirst: number;
    avgSecond: number;
    avgLearning: number;
  }[];
  dimensionAverages: SubScores;
  needsAttention: {
    items: { name: string; email: string; why: string; sessions: number; latestScore: number; lastActive: string }[];
  };
};

export type FxSettings = {
  voice: string;
  feedbackLength: "short" | "standard";
  language: "en";
  audioRetentionDays: 7 | 30 | 90;
  transcriptRetention: "6m" | "12m" | "until_removed";
  candidatesCanDeleteData: boolean;
  senderName: string;
  replyTo: string;
  inviteLinkExpiryDays: number;
  lastExportAt: string | null;
};

export type FxInviteCsv = {
  fileName: string;
  rows: number;
  issues: { row: number; email: string; name: string; roles: string[]; result: string }[];
  readySample: { row: number; email: string; name: string; roles: string[] }[];
};

export type Fixtures = {
  today: string;
  admins: FxAdmin[];
  roles: FxRole[];
  candidates: FxCandidate[];
  inviteCsvExample: FxInviteCsv;
  flashCards_role_sdr: { cards: FxCard[] };
  questions_role_csa: { items: FxQuestion[] };
  sessionReview_sess_priya_3: FxReview;
  report_role_csa: FxReport;
  workspaceSettings: FxSettings;
  auditLog: { items: { who: string; action: string; item: string; when: string }[] };
};

export const fixtures = raw as unknown as Fixtures;
