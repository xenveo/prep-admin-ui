/** FR-ROLE-07: admin-owned preview sessions use the real interview pipeline. */
import { ApiError, request, resolveApiUrl } from "@/lib/api/client";

export const PREVIEW_CONSENT = "I agree that my practice answers are a live AI voice conversation streamed to OpenAI (processed outside India) and transcribed for scoring and feedback. My voice is not recorded. This test interview is excluded from candidate statistics.";
/** Version stored with PREVIEW_CONSENT; bump whenever the text changes. */
export const PREVIEW_CONSENT_VERSION = "admin-preview-v2";
export type SubScoreKey = "content" | "structure" | "delivery" | "relevance";
/** One delivery measure of a voice answer (same shape as the candidate app's DeliveryMetric). */
export type DeliveryMetric = {
  key: "pace" | "fillers" | "pauses";
  label: string;
  /** Always words, e.g. "172 wpm · a bit fast". */
  valueText: string;
  value: number;
  scale: { min: number; max: number };
  target: { min: number; max: number };
  targetText: string;
  note: string;
  inTarget: boolean;
};
export type PreviewFeedback = {
  score: number;
  subScores: Record<SubScoreKey, number>;
  worked: string[];
  improve: string[];
  opener: string;
  focus: string[];
  delivery: DeliveryMetric[];
  /** Words per minute per equal time slice of the answer (3–10 slices); empty without word timings or under 5 s. */
  paceSeries?: number[];
  /** Filler phrases ("um", "you know") with count > 0, most frequent first. */
  fillers?: { text: string; count: number }[];
  /** What the interviewer recommends after this try; a second try is always "next". */
  recommendation?: "retry" | "next";
};
export type PreviewQuestion = { id: string; index: number; text: string; cardId: number; category: string };
export type PreviewAttempt = {
  id: string;
  attemptNo: 1 | 2;
  mode: "voice" | "typed";
  transcript: string;
  durationSec?: number;
  feedback: PreviewFeedback;
  /** Null for live answers (never recorded); older sessions may still have audio. */
  audioUrl: string | null;
  feedbackAudioUrl: string | null;
};
export type PreviewResult = {
  question: PreviewQuestion;
  first: PreviewAttempt;
  second: PreviewAttempt | null;
  state?: "awaiting_retry" | "done";
  /** The probe asked after the first try; the second try answers it. */
  followUp?: string;
};
export type PreviewInProgress = {
  status: "in_progress";
  /** Always "voice" for live interviews. */
  mode: "typed" | "voice";
  currentQuestion: number;
  questions: PreviewQuestion[];
  results: PreviewResult[];
  pending: { questionId: string; attemptNo: 1 | 2 } | null;
  failed: { questionId: string; attemptNo: 1 | 2; code: string } | null;
};
export type PreviewReport = {
  id: string;
  completedAt: string;
  score: number;
  band: string;
  bandMessage: string;
  results: PreviewResult[];
  strengths: { text: string; cardId: number }[];
  focus: { text: string; cardId: number }[];
};
export type PreviewSession = PreviewInProgress | PreviewReport;
export const isPreviewInProgress = (session: PreviewSession): session is PreviewInProgress => "status" in session && session.status === "in_progress";
const id = encodeURIComponent;

/** Starts (or resumes, on 409 session_in_progress) an admin-owned live voice preview. */
export async function startPreview(roleId: string, signal?: AbortSignal): Promise<{ id: string }> {
  try {
    return await request(`/admin/roles/${id(roleId)}/preview-session`, {
      method: "POST", signal,
      body: JSON.stringify({ consent: { liveVoice: true, text: PREVIEW_CONSENT, version: PREVIEW_CONSENT_VERSION } }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "session_in_progress") {
      const session = error.body.session ?? (error.body.error && typeof error.body.error === "object" ? (error.body.error as Record<string, unknown>).session : undefined);
      if (session && typeof session === "object" && "id" in session && typeof session.id === "string") return { id: session.id };
    }
    throw error;
  }
}
export const getPreview = (sessionId: string, signal?: AbortSignal): Promise<PreviewSession> => request(`/sessions/${id(sessionId)}`, { signal });
/** Sends the browser WebRTC offer; the answer SDP starts (or replaces) the live voice session. 503 ai_unavailable when the provider is down. */
export const connectPreviewLive = (sessionId: string, sdp: string, signal?: AbortSignal): Promise<{ sdp: string }> =>
  request(`/sessions/${id(sessionId)}/live`, { method: "POST", body: JSON.stringify({ sdp }), signal });
/** "I'm done answering": scores what was said so far if the interviewer has not handed over yet. */
export const previewAnswerDone = (sessionId: string, signal?: AbortSignal): Promise<void> =>
  request(`/sessions/${id(sessionId)}/live/answer-done`, { method: "POST", signal });
export const skipPreviewRetry = (sessionId: string, questionId: string, signal?: AbortSignal): Promise<void> => request(`/sessions/${id(sessionId)}/questions/${id(questionId)}/skip-retry`, { method: "POST", signal });
export const completePreview = (sessionId: string, signal?: AbortSignal): Promise<PreviewSession> => request(`/sessions/${id(sessionId)}/complete`, { method: "POST", signal });
export const abandonPreview = (sessionId: string, signal?: AbortSignal): Promise<void> => request(`/sessions/${id(sessionId)}/abandon`, { method: "POST", signal });

/** "Try again": the second try at the current question. 409 unless its first try is scored and nothing is pending. */
export const choosePreviewRetry = (sessionId: string, signal?: AbortSignal): Promise<void> =>
  request(`/sessions/${id(sessionId)}/live/retry`, { method: "POST", signal });
/** Asks the interviewer to repeat the current question. */
export const repeatPreviewQuestion = (sessionId: string, signal?: AbortSignal): Promise<void> =>
  request(`/sessions/${id(sessionId)}/live/repeat`, { method: "POST", signal });
/** Pauses or resumes the interviewer. */
export const setPreviewPaused = (sessionId: string, paused: boolean, signal?: AbortSignal): Promise<void> =>
  request(`/sessions/${id(sessionId)}/live/pause`, { method: "POST", body: JSON.stringify({ paused }), signal });

/** Session WebSocket events (LIVE_INTERVIEW_CONTRACT.md). */
export type PreviewEvent =
  | { type: "attempt.received"; attemptId: string; questionId: string; attemptNo: 1 | 2; transcript: string }
  | { type: "attempt.evaluated"; attemptId: string; questionId: string; attemptNo: 1 | 2; attempt: PreviewAttempt; followUp?: string | null }
  | { type: "attempt.failed"; attemptId: string; code: string; retryable: boolean }
  | { type: "question.retry_skipped"; questionId: string }
  | { type: "live.answer_done" }
  | { type: "live.ended"; reason: string }
  | { type: "live.retry_chosen"; questionId: string }
  | { type: "live.paused"; paused: boolean }
  | { type: "live.repeat" };

/** Session event socket (`attempt.*`, `live.ended`, ...); authenticated by the admin login cookie. */
export function previewEventsUrl(sessionId: string): string {
  const url = new URL(resolveApiUrl(`/api/ws/sessions/${id(sessionId)}`));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
