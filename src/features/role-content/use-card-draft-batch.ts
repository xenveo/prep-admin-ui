"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { emitRoleChanged } from "@/lib/role-events";
import { getCardDraftBatch, getLatestCardDraftBatch, isBatchRunning, type CardDraftBatch } from "@/services/card-draft-batches";

export function useCardDraftBatch(roleId: string, batchId?: string, fresh = false) {
  const [batch, setBatch] = useState<CardDraftBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [conflictBatchId, setConflictBatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const actionLock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++epoch.current;
    async function load() {
      setLoading(true);
      setError(null);
      setConflictBatchId(null);
      setPollError(false);
      try {
        const value = fresh && !batchId ? null : batchId
          ? await getCardDraftBatch(roleId, batchId, controller.signal)
          : await getLatestCardDraftBatch(roleId, controller.signal);
        if (!controller.signal.aborted && version === epoch.current) setBatch(value);
      } catch (cause) {
        if (!controller.signal.aborted && version === epoch.current) setError(cause instanceof Error ? cause.message : "Couldn't load this batch.");
      } finally {
        if (!controller.signal.aborted && version === epoch.current) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); };
  }, [roleId, batchId, fresh, reloadKey]);

  const runningId = batch && isBatchRunning(batch) ? batch.id : null;
  useEffect(() => {
    if (!runningId || busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const version = epoch.current;
    async function poll() {
      try {
        const next = await getCardDraftBatch(roleId, runningId!, controller.signal);
        if (controller.signal.aborted || version !== epoch.current) return;
        setBatch(next);
        setPollError(false);
        if (!isBatchRunning(next)) emitRoleChanged(roleId);
      } catch {
        if (controller.signal.aborted || version !== epoch.current) return;
        setPollError(true);
      }
      if (!controller.signal.aborted && version === epoch.current) timer = setTimeout(poll, 2000);
    }
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [roleId, runningId, busy]);

  const run = useCallback(async (operation: () => Promise<CardDraftBatch>): Promise<CardDraftBatch | null> => {
    if (actionLock.current) return null;
    actionLock.current = true;
    const version = ++epoch.current;
    setBusy(true);
    setError(null);
    setConflictBatchId(null);
    try {
      const next = await operation();
      if (mounted.current && version === epoch.current) {
        setBatch(next);
        setPollError(false);
        emitRoleChanged(roleId);
        return next;
      }
      return null;
    } catch (cause) {
      if (mounted.current && version === epoch.current) {
        setError(cause instanceof Error ? cause.message : "That action couldn't be completed. Try again.");
        if (cause instanceof ApiError && typeof cause.body.batchId === "string") setConflictBatchId(cause.body.batchId);
      }
      return null;
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [roleId]);

  return { batch, setBatch, loading, error, pollError, conflictBatchId, busy, run, reload: () => setReloadKey((n) => n + 1) };
}
