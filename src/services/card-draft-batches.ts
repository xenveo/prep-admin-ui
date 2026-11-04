import { request } from "@/lib/api/client";
import type { CardCategory, FlashCard } from "@/lib/types";

export type CategoryMix = "balanced" | Record<CardCategory, number>;
export type CardDraftInput = {
  count: number;
  topics: string[];
  categoryMix: CategoryMix;
  guidance: string;
};
export type BatchCard = FlashCard & { topic?: string | null };
export type CardDraftBatch = {
  id: string;
  roleId: string;
  status: "queued" | "running" | "done" | "failed" | "stopped";
  requestedCount: number;
  generatedCount: number;
  duplicateCount: number;
  discardedCount: number;
  topics: string[];
  categoryMix: CategoryMix;
  guidance: string;
  cards: BatchCard[];
  regeneratingCardId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
};

const base = (roleId: string) => `/admin/roles/${encodeURIComponent(roleId)}/card-draft-batches`;
const batchPath = (roleId: string, batchId: string) => `${base(roleId)}/${encodeURIComponent(batchId)}`;
const post = (body?: unknown): RequestInit => ({ method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const startCardDraftBatch = (roleId: string, input: CardDraftInput): Promise<CardDraftBatch> => request(base(roleId), post(input));
export const getLatestCardDraftBatch = (roleId: string, signal?: AbortSignal): Promise<CardDraftBatch | null> => request(`${base(roleId)}/latest`, { signal });
export const getCardDraftBatch = (roleId: string, batchId: string, signal?: AbortSignal): Promise<CardDraftBatch> => request(batchPath(roleId, batchId), { signal });
export const stopCardDraftBatch = (roleId: string, batchId: string): Promise<CardDraftBatch> => request(`${batchPath(roleId, batchId)}/stop`, post());
export const fillCardDraftBatch = (roleId: string, batchId: string): Promise<CardDraftBatch> => request(`${batchPath(roleId, batchId)}/fill`, post());
export const regenerateBatchCard = (roleId: string, batchId: string, cardId: string): Promise<CardDraftBatch> => request(`${batchPath(roleId, batchId)}/cards/${encodeURIComponent(cardId)}/regenerate`, post());
export const approveBatchCards = (roleId: string, batchId: string, cardIds: string[]): Promise<CardDraftBatch> => request(`${batchPath(roleId, batchId)}/approve`, post({ cardIds }));
export const discardBatchCards = (roleId: string, batchId: string, cardIds: string[]): Promise<CardDraftBatch> => request(`${batchPath(roleId, batchId)}/discard`, post({ cardIds }));

export const isBatchRunning = (batch: CardDraftBatch) => batch.status === "queued" || batch.status === "running";
