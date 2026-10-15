/** HTTP-only shapes. Existing admin read models live in ../types. */
import type { Admin, FlashCard, Question, RoleSettings } from "@/lib/types";
export type { Admin, ApproveRequirements, CandidateDetail, CandidateList, CandidateQuery, EvaluationFlag, InviteBatchResult, InviteRow, InviteSummary, JobRole, Report, SavedFilter, SessionReview, WorkspaceSettings } from "@/lib/types";
export type AdminMe = Admin;
export type RequestCodeResponse = { result: "sent" } | { result: "rate-limited"; retryAfterSec: number };
export type VerifyResponse = { result: "ok" | "wrong" | "expired" };
export type DeactivateResult = { deactivated: number; skipped: number };
export type ReactivateResult = { reactivated: number };
export type AssignRolesResult = { added: number };
export type DraftInput = { count: number };
export type DraftResponse<T = FlashCard | Question> = { jobId: string } | T[];
export type DraftJobStatus<T = FlashCard | Question> = { status: "queued" | "running" } | { status: "done"; result: T[] } | { status: "failed"; code: "ai_unavailable" };
export type RoleSettingsPatch = { settings: RoleSettings };
export type RequestAcknowledgement = { requestId: string };
export type InviteContext = { approvedRoleNames: string[]; draftRoleNames: string[]; existingEmails: string[] };
export type StartSessionInput = { mode: "voice" | "typed"; consent: { recording: true; text: string; version: string } };
export type StartedSession = { id: string; number: number; questions: { id: string; index: number; text: string; cardId: number; category: string }[]; intro: { text: string; audioUrl: string | null }; currentQuestion: number };
