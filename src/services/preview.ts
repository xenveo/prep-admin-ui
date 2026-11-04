/** FR-ROLE-07: admin-owned preview sessions use the real interview pipeline. */
import { ApiError, request, resolveApiUrl } from "@/lib/api/client";

export const PREVIEW_CONSENT = "I agree that my practice answers are a live AI voice conversation streamed to OpenAI (processed outside India) and transcribed for scoring and feedback. My voice is not recorded. This test interview is excluded from candidate statistics.";
export type PreviewQuestion = { id: string; index: number; text: string; cardId: number; category: string };
export type PreviewAttempt = {
  id: string;
  attemptNo: 1 | 2;
  mode: "voice" | "typed";
  transcript: string;
  durationSec?: number;
  feedback: { score: number; worked: string[]; improve: string[]; opener: string; focus: string[] };
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
      body: JSON.stringify({ consent: { liveVoice: true, text: PREVIEW_CONSENT, version: "admin-preview-v2" } }),
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

/** Session event socket (`attempt.*`, `live.ended`, ...); authenticated by the admin login cookie. */
export function previewEventsUrl(sessionId: string): string {
  const url = new URL(resolveApiUrl(`/api/ws/sessions/${id(sessionId)}`));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** Cancellable delay shared by the bounded session polling loop. */
export function previewPollDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2000);
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}
