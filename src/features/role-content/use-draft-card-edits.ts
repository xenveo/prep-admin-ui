"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/ui/toast";
import { saveFlashCard } from "@/services/roles";
import type { BatchCard, CardDraftBatch } from "@/services/card-draft-batches";

type SaveStatus = "saving" | "saved" | "error";
export type CardPatch = Partial<Pick<BatchCard, "category" | "question" | "strongAnswerPoints" | "commonMistakes" | "tip" | "sampleAnswerOutline">>;

/** Separate local edits from polled batch data, and serialize every save for a given card. */
export function useDraftCardEdits(roleId: string, batch: CardDraftBatch | null, setBatch: Dispatch<SetStateAction<CardDraftBatch | null>>) {
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, BatchCard>>({});
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const dirty = useRef(new Map<string, BatchCard>());
  const revisions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Promise<void>>());
  const mounted = useRef(true);
  const frozen = useRef(new Set<string>());

  const persist = useCallback(async function persistCard(id: string): Promise<void> {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    if (frozen.current.has(id)) {
      await pending.current.get(id);
      return;
    }
    const card = dirty.current.get(id);
    if (!card) {
      await pending.current.get(id);
      return;
    }
    const revision = revisions.current.get(id);
    if (mounted.current) setStatuses((prev) => ({ ...prev, [id]: "saving" }));
    const previous = pending.current.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const saved = await saveFlashCard(roleId, {
        roleId, id: card.id, category: card.category, question: card.question,
        strongAnswerPoints: card.strongAnswerPoints.filter((line) => line.trim()),
        commonMistakes: card.commonMistakes.filter((line) => line.trim()),
        tip: card.tip, sampleAnswerOutline: card.sampleAnswerOutline?.trim() || null,
      });
      if (!mounted.current) return;
      setBatch((current) => current ? { ...current, cards: current.cards.map((item) => item.id === id ? { ...saved, topic: card.topic } : item) } : current);
      if (revisions.current.get(id) === revision) {
        dirty.current.delete(id);
        setEdits((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setStatuses((current) => ({ ...current, [id]: "saved" }));
      }
    });
    pending.current.set(id, operation);
    try {
      await operation;
    } catch (cause) {
      if (mounted.current) setStatuses((current) => ({ ...current, [id]: "error" }));
      else toast.show({ title: "Card changes weren’t saved", detail: cause instanceof Error ? cause.message : "Try saving again.", action: { label: "Retry save", onClick: () => { void persistCard(id).catch(() => {}); } } });
      throw cause;
    }
  }, [roleId, setBatch, toast]);

  const edit = useCallback((card: BatchCard, patch: CardPatch) => {
    if (frozen.current.has(card.id)) return;
    const next = { ...(dirty.current.get(card.id) ?? card), ...patch };
    dirty.current.set(card.id, next);
    revisions.current.set(card.id, (revisions.current.get(card.id) ?? 0) + 1);
    setEdits((current) => ({ ...current, [card.id]: next }));
    setStatuses((current) => ({ ...current, [card.id]: "saving" }));
    const previous = timers.current.get(card.id);
    if (previous) clearTimeout(previous);
    timers.current.set(card.id, setTimeout(() => { void persist(card.id).catch(() => {}); }, 650));
  }, [persist]);

  const flush = useCallback(async (onlyIds?: string[]) => {
    const ids = new Set(onlyIds ?? [...dirty.current.keys(), ...pending.current.keys()]);
    await Promise.all([...ids].map(persist));
  }, [persist]);

  const settle = useCallback(async (ids: string[]) => {
    // Freeze before awaiting: blur handlers and unmount cleanup cannot enqueue a late save.
    for (const id of ids) {
      frozen.current.add(id);
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.delete(id);
    }
    await Promise.allSettled(ids.map((id) => pending.current.get(id)));
  }, []);

  const forget = useCallback((ids: string[]) => {
    for (const id of ids) {
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.delete(id);
      dirty.current.delete(id);
      revisions.current.delete(id);
      pending.current.delete(id);
      frozen.current.delete(id);
    }
    if (!mounted.current) return;
    setEdits((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
    setStatuses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
  }, []);

  const resume = useCallback((ids: string[]) => {
    if (!mounted.current) return;
    for (const id of ids) {
      frozen.current.delete(id);
      if (dirty.current.has(id)) timers.current.set(id, setTimeout(() => { void persist(id).catch(() => {}); }, 650));
    }
  }, [persist]);

  useEffect(() => {
    mounted.current = true;
    const map = timers.current;
    const changes = dirty.current;
    return () => {
      // Capture the last fields before the component goes away; an in-flight save always runs first.
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
      for (const id of changes.keys()) void persist(id).catch(() => {});
      mounted.current = false;
    };
  }, [persist]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current.size) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return {
    cards: batch?.cards.map((card) => edits[card.id] ?? card) ?? [],
    statuses, edit, flush, persist, settle, forget, resume,
    hasUnsaved: Object.keys(edits).length > 0,
  };
}
