/**
 * In-memory module-singleton store, seeded (deep-cloned) from the sample fixtures.
 * Services read and mutate this; they return clones, never store references.
 */
import { bandForScore, toBand } from "@/lib/bands";
import {
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_SESSION_WEIGHTS,
  NOW_ISO,
  type ActivityItem,
  type Admin,
  type AuditEvent,
  type CandidateStatus,
  type EvaluationFlag,
  type FlashCard,
  type JobRole,
  type Question,
  type RoleSettings,
  type RoleStatus,
  type SavedFilter,
  type SessionReview,
  type SessionSummary,
  type Source,
  type TestEvaluation,
  type Try,
  type WorkspaceSettings,
} from "@/lib/types";
import { fixtures, type FxQuestion, type FxRole, type FxTry } from "@/services/fixtures";
import { sessionFormulaText } from "@/services/scoring";
import { BAND_LABEL } from "@/lib/bands";

export type StoredRole = Omit<
  JobRole,
  "flashCardCount" | "questionCount" | "aiDraftCardCount" | "aiDraftQuestionCount" | "candidatesAssigned" | "updatedByName" | "avgLatestBand"
> & {
  /**
   * Fixtures give role-level counts but only some roles have item lists. Counts shown are
   * `list length + offset`, so counts stay consistent when items are added or removed.
   */
  offsets: { cards: number; questions: number; aiCards: number; aiQuestions: number; rubric: number; assigned: number };
};

export type StoredAssignment = { roleId: string; assignedAt: string; maxSessions: number | null };

export type StoredCandidate = {
  id: string;
  name: string;
  email: string;
  status: CandidateStatus;
  invitedAt: string;
  invitedBy: string;
  firstLoginAt?: string;
  lastActiveAt: string | null;
  accessUntil?: string | null;
  assignments: StoredAssignment[];
  activity: ActivityItem[];
  source?: Source;
};

export type StoredInviteBatch = {
  id: string;
  createdBy: string;
  createdAt: string;
  source: "single" | "csv";
  fileName?: string;
  sent: number;
  skipped: number;
};

export type Store = {
  admins: Admin[];
  currentAdminId: string;
  settings: WorkspaceSettings;
  audit: AuditEvent[];
  roles: StoredRole[];
  cards: FlashCard[];
  questions: Question[];
  candidates: StoredCandidate[];
  sessions: SessionSummary[];
  reviews: Record<string, SessionReview>;
  flags: EvaluationFlag[];
  savedFilters: SavedFilter[];
  invites: StoredInviteBatch[];
  counters: Record<string, number>;
};

const MIN_RUBRIC_POINTS_FOR_COUNT = 1;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function descriptionHtml(d?: { text: string; bullets: string[] }): string {
  if (!d) return "";
  const list = d.bullets.length ? `<ul>${d.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  return `<p>${esc(d.text)}</p>${list}`;
}

function defaultSettings(): RoleSettings {
  return {
    questionsPerSession: 5,
    questionOrder: "fixed",
    answerGuideSeconds: 120,
    requireAllCards: true,
    maxSessionsPerCandidate: 5,
    sessionWeights: { ...DEFAULT_SESSION_WEIGHTS },
    dimensionWeights: { ...DEFAULT_DIMENSION_WEIGHTS },
  };
}

const hasRubric = (q: Question) => q.rubric.keyPoints.length >= MIN_RUBRIC_POINTS_FOR_COUNT;
export const countRubricQuestions = (qs: Question[]) => qs.filter((q) => q.status === "approved" && hasRubric(q)).length;

function seedTry(t: FxTry): Try {
  const [m, s] = t.audio.split(":").map(Number);
  return {
    attempt: t.attempt,
    mode: "voice",
    score: t.score,
    band: toBand(t.band),
    audioSeconds: m * 60 + s,
    audioLabel: t.audio,
    audioUrl: null,
    subScores: t.subScores,
    transcript: t.transcript,
    highlights: t.highlights,
    worked: t.worked,
    improve: t.improve,
    delivery: t.delivery,
    appliedFromFeedback: t.appliedFromFeedback,
  };
}

function seedQuestion(roleId: string, q: FxQuestion): Question {
  const sample: TestEvaluation | undefined = q.testEvaluation && {
    ...q.testEvaluation,
    band: toBand(q.testEvaluation.band),
    isTest: true,
  };
  return {
    id: q.id,
    roleId,
    cardId: null,
    text: q.text,
    category: q.category,
    difficulty: q.difficulty,
    status: q.status,
    // Fixtures only carry a rubric for q1; the rest start with an empty one rather than invented content.
    rubric: q.rubric ?? { keyPoints: [], redFlags: [], expectedStructure: "free" },
    timesAsked: q.timesAsked,
    avgFirstTry: q.avgFirst,
    avgSecondTry: q.avgSecond,
    avgLearning: q.avgLearning,
    sampleEvaluation: sample,
  };
}

function build(): Store {
  const fx = fixtures;

  const admins: Admin[] = fx.admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    title: a.title,
    access: a.access,
    status: a.status,
    lastActiveAt: a.lastActive ?? null,
    invitedAt: a.invitedAt,
    source: a.source as Source | undefined,
  }));

  const cards: FlashCard[] = fx.flashCards_role_sdr.cards.map((c, i) => ({
    id: `card_sdr_${c.id}`,
    roleId: "role_sdr",
    sampleAnswerOutline: null,
    position: i + 1,
    category: c.category,
    question: c.question,
    strongAnswerPoints: c.strong,
    tip: c.tip,
    commonMistakes: c.mistakes,
    status: c.status,
    createdBy: c.status === "ai_draft" ? "ai" : "adm_arjun",
    approvedBy: c.status === "approved" ? "adm_arjun" : undefined,
  }));

  const questions: Question[] = fx.questions_role_csa.items.map((q) => seedQuestion("role_csa", q));

  const candidates: StoredCandidate[] = [];
  const sessions: SessionSummary[] = [];
  for (const c of fx.candidates) {
    const history = c.sessionHistory ?? [];
    const oldest = [...history].sort((a, b) => a.number - b.number)[0];
    const invitedAt = c.invitedAt ?? oldest?.date.slice(0, 10) ?? "2026-10-01";
    const maxSessions = c.sessionsUsed ? Number(c.sessionsUsed.split(" of ")[1]) : 5;
    const activity: ActivityItem[] = c.activity
      ? c.activity.map(([text, at]) => ({ text, at }))
      : [
          ...history.map((s) => ({
            text: `Completed session ${s.number} · ${s.score} ${BAND_LABEL[toBand(s.band)]}${s.number === 1 ? " (baseline)" : ""}`,
            at: s.date,
          })),
          ...(c.invitedAt || c.status === "invite_pending" ? [{ text: "Invited by Arjun Mehta", at: invitedAt }] : []),
        ];
    candidates.push({
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      invitedAt,
      invitedBy: "adm_arjun",
      firstLoginAt: c.firstLoginAt,
      lastActiveAt: c.lastActive,
      assignments: c.roles.map((roleId) => ({ roleId, assignedAt: invitedAt, maxSessions })),
      activity,
      source: c.source as Source | undefined,
    });
    for (const s of history) {
      sessions.push({
        id: s.id,
        candidateId: c.id,
        roleId: c.roles[0],
        roleTitle: fx.roles.find((r) => r.id === c.roles[0])?.title ?? "",
        number: s.number,
        date: s.date,
        score: s.score,
        band: toBand(s.band),
        durationMin: s.durationMin,
      });
    }
  }

  const seededAssigned = (roleId: string) => candidates.filter((c) => c.assignments.some((a) => a.roleId === roleId)).length;
  const seededCards = (roleId: string) => cards.filter((c) => c.roleId === roleId);
  const seededQs = (roleId: string) => questions.filter((q) => q.roleId === roleId);

  const roles: StoredRole[] = fx.roles.map((r: FxRole) => {
    const rc = seededCards(r.id);
    const rq = seededQs(r.id);
    const aiQuestions = r.questionDraftsToReview ?? 0;
    // Questions with rubrics: all approved questions, except the draft role which the design blocks at "5 questions with rubrics".
    const rubricTotal = r.id === "role_sdr" ? 3 : r.questions - aiQuestions;
    return {
      id: r.id,
      title: r.title,
      seniority: r.seniority,
      status: r.status,
      description: descriptionHtml(r.description),
      keySkills: r.keySkills ?? [],
      settings: r.settings ?? defaultSettings(),
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy ?? null,
      avgLatestScore: r.avgLatestScore,
      source: r.source as Source | undefined,
      illustrativeFields: r.illustrativeFields,
      offsets: {
        cards: r.flashCards - rc.length,
        questions: r.questions - rq.length,
        aiCards: (r.aiDraftsToReview ?? 0) - rc.filter((c) => c.status === "ai_draft").length,
        aiQuestions: aiQuestions - rq.filter((q) => q.status === "ai_draft").length,
        rubric: rubricTotal - countRubricQuestions(rq),
        assigned: r.candidatesAssigned - seededAssigned(r.id),
      },
    };
  });

  // Session review (only Priya's session 3 has full detail).
  const rv = fx.sessionReview_sess_priya_3;
  const csaQuestions = questions.filter((q) => q.roleId === rv.role);
  const reviewQuestions = rv.questions.map((q) => {
    const match = csaQuestions.find((x) => x.text === q.text);
    const base = { n: q.n, text: q.text, category: match?.category, firstScore: q.first, secondScore: q.second, retrySkipped: false };
    return q.n === 2 ? { ...base, tries: rv.question2.tries.map(seedTry) as [Try, Try] } : base;
  });
  const reviews: Record<string, SessionReview> = {
    sess_priya_3: {
      sessionId: "sess_priya_3",
      candidateId: rv.candidate,
      candidateName: candidates.find((c) => c.id === rv.candidate)?.name ?? "",
      roleId: rv.role,
      roleTitle: fx.roles.find((r) => r.id === rv.role)?.title ?? "",
      sessionNumber: 3,
      date: rv.date,
      durationMin: rv.durationMin,
      score: rv.score,
      band: toBand(rv.band),
      changeVsPrevious: rv.changeVsPrevious,
      firstTryAvg: rv.firstTryAvg,
      secondTryAvg: rv.secondTryAvg,
      learningScore: rv.learningScore,
      hasDetail: true,
      questions: reviewQuestions,
      weights: { ...DEFAULT_SESSION_WEIGHTS },
      formulaText: sessionFormulaText(rv.score),
      source: "illustrative",
    },
  };
  const flags: EvaluationFlag[] = rv.flags.map((f, i) => ({
    id: `flag_seed_${i + 1}`,
    sessionId: "sess_priya_3",
    title: f.title,
    questionNumber: Number(/Q(\d+)/.exec(f.title)?.[1] ?? 0),
    dimension: "delivery",
    note: f.note,
    createdBy: fx.admins.find((a) => a.name === f.by)?.id ?? "adm_arjun",
    createdByName: f.by,
    createdAt: f.date,
    status: f.status,
    resolution: f.resolution,
  }));

  const audit: AuditEvent[] = fx.auditLog.items.map((e, i) => ({
    id: `aud_seed_${i + 1}`,
    actorId: fx.admins.find((a) => a.name === e.who)?.id ?? null,
    actor: e.who,
    action: e.action,
    itemLabel: e.item,
    at: e.when,
    source: "illustrative",
  }));

  // Saved filter definitions are proposed by design (open question): confirm before shipping.
  const savedFilters: SavedFilter[] = [
    { id: "all", label: "All candidates", query: {}, isDefault: true, source: "brief" },
    { id: "not_ready", label: "Not ready yet", query: { bands: ["not_ready"] }, source: "illustrative" },
    { id: "no_change", label: "No change in 2 sessions", query: { noChangeInSessions: 2 }, source: "illustrative" },
    { id: "invite_pending", label: "Invite pending", query: { statuses: ["invite_pending"] }, source: "illustrative" },
  ];

  return {
    admins,
    currentAdminId: "adm_arjun",
    settings: { ...fx.workspaceSettings },
    audit,
    roles,
    cards,
    questions,
    candidates,
    sessions,
    reviews,
    flags,
    savedFilters,
    invites: [],
    counters: {},
  };
}

let store: Store | null = null;

/** The singleton store (created and seeded on first use). */
export function getStore(): Store {
  if (!store) store = build();
  return store;
}

/** Test helper: re-seed from fixtures. */
export function resetStore(): void {
  store = build();
}

export function nextId(prefix: string): string {
  const s = getStore();
  s.counters[prefix] = (s.counters[prefix] ?? 0) + 1;
  return `${prefix}_${s.counters[prefix]}`;
}

/** Fixed "now" with a minute that advances per call so new events sort after the seeded ones. */
export function stamp(): string {
  const s = getStore();
  s.counters.clock = (s.counters.clock ?? 0) + 1;
  const minute = Math.min(59, 45 + s.counters.clock);
  return NOW_ISO.replace("11:45", `11:${String(minute).padStart(2, "0")}`);
}

export function currentAdmin(): Admin {
  const s = getStore();
  const a = s.admins.find((x) => x.id === s.currentAdminId);
  if (!a) throw new Error("No current admin");
  return a;
}

export function adminName(id: string | null | undefined): string | null {
  if (!id) return null;
  return getStore().admins.find((a) => a.id === id)?.name ?? null;
}

export function addAudit(action: string, itemLabel: string, itemRef?: string): AuditEvent {
  const s = getStore();
  const me = currentAdmin();
  const event: AuditEvent = {
    id: nextId("aud"),
    actorId: me.id,
    actor: me.name ?? me.email,
    action,
    itemLabel,
    itemRef,
    at: stamp(),
  };
  s.audit.unshift(event);
  return event;
}

export function touchRole(role: StoredRole): void {
  role.updatedAt = stamp();
  role.updatedBy = currentAdmin().id;
}

/** Latest-session average per role, used for the role's "avg latest score". */
function liveAvgLatest(roleId: string): number | null {
  const s = getStore();
  const latest = s.candidates
    .filter((c) => c.assignments.some((a) => a.roleId === roleId))
    .map((c) => s.sessions.filter((x) => x.candidateId === c.id && x.roleId === roleId).sort((a, b) => b.number - a.number)[0])
    .filter(Boolean);
  if (latest.length === 0) return null;
  return Math.round(latest.reduce((n, x) => n + x.score, 0) / latest.length);
}

export function roleView(role: StoredRole): JobRole {
  const s = getStore();
  const rc = s.cards.filter((c) => c.roleId === role.id);
  const rq = s.questions.filter((q) => q.roleId === role.id);
  const { offsets, ...rest } = role;
  const live = role.status === "approved";
  // Fixture averages cover the whole role (38 candidates); keep them. Only fall back to live data if none.
  const avg = live ? (role.avgLatestScore ?? liveAvgLatest(role.id)) : null;
  return {
    ...rest,
    updatedByName: adminName(role.updatedBy),
    flashCardCount: rc.length + offsets.cards,
    questionCount: rq.length + offsets.questions,
    aiDraftCardCount: rc.filter((c) => c.status === "ai_draft").length + offsets.aiCards,
    aiDraftQuestionCount: rq.filter((q) => q.status === "ai_draft").length + offsets.aiQuestions,
    candidatesAssigned: s.candidates.filter((c) => c.assignments.some((a) => a.roleId === role.id)).length + offsets.assigned,
    avgLatestScore: avg,
    avgLatestBand: avg == null ? null : bandForScore(avg),
  };
}

export function findRole(id: string): StoredRole {
  const role = getStore().roles.find((r) => r.id === id);
  if (!role) throw new Error(`Role not found: ${id}`);
  return role;
}

export function findCandidate(id: string): StoredCandidate {
  const c = getStore().candidates.find((x) => x.id === id);
  if (!c) throw new Error(`Candidate not found: ${id}`);
  return c;
}

export function roleStatusOf(roleId: string): RoleStatus {
  return findRole(roleId).status;
}

export function logActivity(c: StoredCandidate, text: string): void {
  c.activity.unshift({ text, at: stamp() });
}
