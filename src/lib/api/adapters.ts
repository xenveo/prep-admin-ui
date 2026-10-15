import type { Admin, SessionReview } from "@/lib/types";
import { resolveApiUrl } from "./client";
/** Backend media redirects are relative to the API host. */
export function adaptSessionReview(review: SessionReview): SessionReview {
  return { ...review, questions: review.questions.map(question => ({ ...question, tries: question.tries?.map(attempt => ({ ...attempt, audioUrl: attempt.audioUrl ? resolveApiUrl(attempt.audioUrl) : null })) })) };
}
export function adminDisplayName(admin: Pick<Admin, "name" | "email">): string {
  return admin.name?.trim() || admin.email;
}
