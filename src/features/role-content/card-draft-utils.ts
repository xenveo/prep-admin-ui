import { CARD_CATEGORY_LABEL, SAMPLE_OUTLINE_MAX_LENGTH, TIP_MAX_LENGTH, type CardCategory } from "@/lib/types";
import type { BatchCard } from "@/services/card-draft-batches";

export const CARD_CATEGORIES = Object.keys(CARD_CATEGORY_LABEL) as CardCategory[];
export const outlineSteps = (outline: string | null) => (outline ?? "").split(/\r?\n/);
export const nonempty = (items: string[]) => items.filter((item) => item.trim());

/** Keep approval guidance consistent with the server's structured batch requirements. */
export function cardIssues(card: BatchCard): string[] {
  const issues: string[] = [];
  if (!card.question.trim()) issues.push("a question");
  else if (card.question.length > 500) issues.push("a shorter question");
  if (nonempty(card.strongAnswerPoints).length < 3) issues.push("3 strong-answer points");
  if (nonempty(card.commonMistakes).length < 2) issues.push("2 common mistakes");
  if ([...card.strongAnswerPoints, ...card.commonMistakes].some((line) => line.length > 500)) issues.push("shorter answer points");
  if (!card.tip.trim()) issues.push("a practical tip");
  else if (card.tip.length > TIP_MAX_LENGTH) issues.push("a shorter tip");
  if (nonempty(outlineSteps(card.sampleAnswerOutline)).length < 3) issues.push("3 outline steps");
  if ((card.sampleAnswerOutline ?? "").length > SAMPLE_OUTLINE_MAX_LENGTH) issues.push("a shorter outline");
  return issues;
}
