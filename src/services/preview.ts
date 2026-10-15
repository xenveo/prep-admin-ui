/** FR-ROLE-07: admin-owned preview sessions use the real interview pipeline. */
import { ApiError, request } from "@/lib/api/client";

export const PREVIEW_CONSENT = "I agree to have my practice answers processed by AI to generate feedback. This test interview is excluded from candidate statistics.";
export type PreviewQuestion = { id: string; index: number; text: string; cardId: number; category: string };
export type PreviewAttempt = {
  id: string;
  attemptNo: 1 | 2;
  mode: "voice" | "typed";
  transcript: string;
  feedback: { score: number; worked: string[]; improve: string[]; opener: string; focus: string[] };
  audioUrl: string | null;
  feedbackAudioUrl: string | null;
};
export type PreviewResult = {
  question: PreviewQuestion;
  first: PreviewAttempt;
  second: PreviewAttempt | null;
  state?: "awaiting_retry" | "done";
};
export type PreviewInProgress = {
  status: "in_progress";
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

export async function startPreview(roleId: string, signal?: AbortSignal): Promise<{ id: string }> {
  try {
    return await request(`/admin/roles/${id(roleId)}/preview-session`, {
      method: "POST", signal,
      body: JSON.stringify({ mode: "typed", consent: { recording: true, text: PREVIEW_CONSENT, version: "admin-preview-v1" } }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "session_in_progress") {
      const session = error.body.session;
      if (session && typeof session === "object" && "id" in session && typeof session.id === "string") return { id: session.id };
    }
    throw error;
  }
}
export const getPreview = (sessionId: string, signal?: AbortSignal): Promise<PreviewSession> => request(`/sessions/${id(sessionId)}`, { signal });
export function submitPreviewAnswer(sessionId: string, questionId: string, attemptNo: 1 | 2, text: string, key: string, signal?: AbortSignal): Promise<{ attemptId: string }> {
  const body = new FormData();
  body.set("attemptNo", String(attemptNo));
  body.set("mode", "typed");
  body.set("text", text);
  body.set("durationSec", "0");
  return request(`/sessions/${id(sessionId)}/questions/${id(questionId)}/attempts`, { method: "POST", headers: { "Idempotency-Key": key }, body, signal });
}
export const skipPreviewRetry = (sessionId: string, questionId: string, signal?: AbortSignal): Promise<void> => request(`/sessions/${id(sessionId)}/questions/${id(questionId)}/skip-retry`, { method: "POST", signal });
export const completePreview = (sessionId: string, signal?: AbortSignal): Promise<PreviewSession> => request(`/sessions/${id(sessionId)}/complete`, { method: "POST", signal });
export const abandonPreview = (sessionId: string, signal?: AbortSignal): Promise<void> => request(`/sessions/${id(sessionId)}/abandon`, { method: "POST", signal });

/** Cancellable delay shared by the bounded session polling loop. */
export function previewPollDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2000);
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}
