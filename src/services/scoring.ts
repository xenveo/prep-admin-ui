/** Scoring formulas from docs/domain-model.md. Pure functions. */
import { bandForScore, type Band } from "@/lib/bands";
import {
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_SESSION_WEIGHTS,
  DIMENSION_IDS,
  type DimensionWeights,
  type SessionWeights,
  type SubScores,
} from "@/lib/types";

/** Sum of the weights in a group (each group must be 100). */
export function weightsTotal(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + b, 0);
}

export function weightsValid(weights: Record<string, number>): boolean {
  return weightsTotal(weights) === 100;
}

/** Unrounded answer score: sum of sub-score x weight. 52/40/58/60 -> 52. */
export function answerScoreRaw(sub: SubScores, weights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS): number {
  return DIMENSION_IDS.reduce((sum, id) => sum + (sub[id] * weights[id]) / 100, 0);
}

/** Answer score rounded to an integer. */
export function answerScore(sub: SubScores, weights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS): number {
  return Math.round(answerScoreRaw(sub, weights));
}

/** Unrounded session score: first x 20% + second x 55% + learning x 25% (defaults). */
export function sessionScoreRaw(
  firstTryAvg: number,
  secondTryAvg: number,
  learningScore: number,
  weights: SessionWeights = DEFAULT_SESSION_WEIGHTS,
): number {
  return (firstTryAvg * weights.firstTry + secondTryAvg * weights.secondTry + learningScore * weights.learning) / 100;
}

/** Session score rounded to an integer. */
export function sessionScore(
  firstTryAvg: number,
  secondTryAvg: number,
  learningScore: number,
  weights: SessionWeights = DEFAULT_SESSION_WEIGHTS,
): number {
  return Math.round(sessionScoreRaw(firstTryAvg, secondTryAvg, learningScore, weights));
}

export function bandOf(score: number): Band {
  return bandForScore(score);
}

/** Sentence under the A8 stat strip: "20% first try + 55% second try + 25% learning = 78". */
export function sessionFormulaText(score: number, weights: SessionWeights = DEFAULT_SESSION_WEIGHTS): string {
  return `${weights.firstTry}% first try + ${weights.secondTry}% second try + ${weights.learning}% learning = ${score}`;
}

/** Verifies the A8 example: 62 / 80 / 86 -> 77.9 -> 78. */
export function verifySessionFormulaExample(): { raw: number; rounded: number; expected: 78; ok: boolean } {
  const raw = sessionScoreRaw(62, 80, 86);
  const rounded = Math.round(raw);
  return { raw: Math.round(raw * 100) / 100, rounded, expected: 78, ok: rounded === 78 };
}

/** Verifies the answer example: 52/40/58/60 at default weights -> 52. */
export function verifyAnswerFormulaExample(): { raw: number; rounded: number; expected: 52; ok: boolean } {
  const raw = answerScoreRaw({ content: 52, structure: 40, delivery: 58, relevance: 60 });
  return { raw: Math.round(raw * 100) / 100, rounded: Math.round(raw), expected: 52, ok: Math.round(raw) === 52 };
}
