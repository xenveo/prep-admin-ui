/** Session review and evaluation flags (A8). */
import { formatDate } from "@/lib/format";
import {
  DEFAULT_SESSION_WEIGHTS,
  FLAG_DIMENSION_LABEL,
  type EvaluationFlag,
  type FlagInput,
  type SessionReview,
} from "@/lib/types";
import { respond } from "@/services/latency";
import { sessionFormulaText } from "@/services/scoring";
import { addAudit, currentAdmin, findCandidate, getStore, nextId, stamp } from "@/services/store";

/**
 * Review for one session. Only Priya's session 3 has full detail in the fixtures; other sessions
 * return the summary with `hasDetail: false` and no questions. Rejects for unknown ids.
 */
export function getSessionReview(candidateId: string, sessionId: string): Promise<SessionReview> {
  return respond(() => {
    const s = getStore();
    const session = s.sessions.find((x) => x.id === sessionId && x.candidateId === candidateId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const detailed = s.reviews[sessionId];
    const previous = s.sessions
      .filter((x) => x.candidateId === candidateId && x.roleId === session.roleId && x.number === session.number - 1)[0];
    if (detailed) return detailed;
    return {
      sessionId,
      candidateId,
      candidateName: findCandidate(candidateId).name,
      roleId: session.roleId,
      roleTitle: session.roleTitle,
      sessionNumber: session.number,
      date: session.date,
      durationMin: session.durationMin,
      score: session.score,
      band: session.band,
      changeVsPrevious: previous ? session.score - previous.score : null,
      firstTryAvg: null,
      secondTryAvg: null,
      learningScore: null,
      hasDetail: false,
      questions: [],
      weights: { ...DEFAULT_SESSION_WEIGHTS },
      formulaText: sessionFormulaText(session.score),
    };
  });
}

/** Add a flag (status open). A flag never changes a score. */
export function submitFlag(input: FlagInput): Promise<EvaluationFlag> {
  return respond(() => {
    const s = getStore();
    const session = s.sessions.find((x) => x.id === input.sessionId);
    if (!session) throw new Error(`Session not found: ${input.sessionId}`);
    const me = currentAdmin();
    const flag: EvaluationFlag = {
      id: nextId("flag"),
      sessionId: input.sessionId,
      title: `Session ${session.number} · Q${input.questionNumber} · ${FLAG_DIMENSION_LABEL[input.dimension]}`,
      questionNumber: input.questionNumber,
      dimension: input.dimension,
      issue: input.issue,
      note: input.note?.trim() ?? "",
      createdBy: me.id,
      createdByName: me.name ?? me.email,
      createdAt: stamp(),
      status: "open",
    };
    s.flags.unshift(flag);
    const candidate = findCandidate(session.candidateId);
    addAudit("Flagged an evaluation", `${candidate.name} · session ${session.number} · question ${input.questionNumber}`, input.sessionId);
    return flag;
  });
}

/** Flag history for a session, newest first. */
export function listFlags(sessionId: string): Promise<EvaluationFlag[]> {
  return respond(() =>
    getStore()
      .flags.filter((f) => f.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** "15 Oct 2026" helper kept here so A8 can label flag dates consistently. */
export function flagDateLabel(flag: EvaluationFlag): string {
  return formatDate(flag.createdAt);
}
