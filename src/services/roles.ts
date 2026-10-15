/** Server-backed role and content authoring. */
import { request } from "@/lib/api/client";
import type { ApproveRequirements, FlashCard, FlashCardInput, JobRole, Question, QuestionInput, RoleInput, RolePatch, TestEvaluation } from "@/lib/types";
const id = encodeURIComponent;
const json = (method: string, body?: unknown, signal?: AbortSignal): RequestInit => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal });
export const listRoles = (): Promise<JobRole[]> => request("/admin/roles");
export const getRole = (roleId: string): Promise<JobRole> => request(`/admin/roles/${id(roleId)}`);
export const createRole = (input: RoleInput): Promise<JobRole> => request("/admin/roles", json("POST", input));
export const updateRole = (roleId: string, patch: RolePatch): Promise<JobRole> => request(`/admin/roles/${id(roleId)}`, json("PATCH", patch));
export const getApproveRequirements = (roleId: string): Promise<ApproveRequirements> => request(`/admin/roles/${id(roleId)}/approve-requirements`);
export const approveRole = (roleId: string): Promise<{role: JobRole; notified: number}> => request(`/admin/roles/${id(roleId)}/approve`, json("POST"));
export const archiveRole = (roleId: string): Promise<JobRole> => request(`/admin/roles/${id(roleId)}/archive`, json("POST"));
export const listFlashCards = (roleId: string): Promise<FlashCard[]> => request(`/admin/roles/${id(roleId)}/cards`);
export const saveFlashCard = (roleId: string, input: FlashCardInput): Promise<FlashCard> => request(input.id ? `/admin/cards/${id(input.id)}` : `/admin/roles/${id(roleId)}/cards`, json(input.id ? "PUT" : "POST", input));
export const reorderFlashCards = (roleId: string, orderedIds: string[]): Promise<FlashCard[]> => request(`/admin/roles/${id(roleId)}/cards/order`, json("PUT", {orderedIds}));
export const approveFlashCard = (cardId: string): Promise<FlashCard> => request(`/admin/cards/${id(cardId)}/approve`, json("POST"));
export const discardFlashCard = (cardId: string): Promise<void> => request(`/admin/cards/${id(cardId)}`, json("DELETE"));
export const listQuestions = (roleId: string): Promise<Question[]> => request(`/admin/roles/${id(roleId)}/questions`);
export const saveQuestion = (roleId: string, input: QuestionInput): Promise<Question> => request(input.id ? `/admin/questions/${id(input.id)}` : `/admin/roles/${id(roleId)}/questions`, json(input.id ? "PUT" : "POST", input));
export const deleteQuestion = (questionId: string): Promise<void> => request(`/admin/questions/${id(questionId)}`, json("DELETE"));
export const evaluateSampleAnswer = (questionId: string, answer: string): Promise<TestEvaluation> => request(`/admin/questions/${id(questionId)}/test`, json("POST", {answer}));

async function draft<T>(roleId: string, kind: "cards" | "questions", signal?: AbortSignal): Promise<T[]> {
  const started = await request<T[] | {jobId: string}>(`/admin/roles/${id(roleId)}/${kind}/draft-ai`, json("POST", {}, signal));
  if (Array.isArray(started)) return started;
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException("Draft polling cancelled", "AbortError")); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, 2000);
      if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, {once:true});
    });
    const job = await request<{status: "queued"|"running"|"done"|"failed"; result?:T[]; code?:string}>(`/admin/ai-jobs/${id(started.jobId)}`, {signal});
    if (job.status === "done") { if (!Array.isArray(job.result)) throw new Error("The draft job returned no content. Refresh the content list."); return job.result; }
    if (job.status === "failed") throw new Error("AI drafting failed. Please try again.");
  }
  throw new Error("AI drafting is still running. Refresh the content list in a moment before starting another draft.");
}
export const draftFlashCardsWithAI = (roleId:string, signal?:AbortSignal):Promise<FlashCard[]> => draft(roleId,"cards",signal);
export const draftQuestionsWithAI = (roleId:string, signal?:AbortSignal):Promise<Question[]> => draft(roleId,"questions",signal);
