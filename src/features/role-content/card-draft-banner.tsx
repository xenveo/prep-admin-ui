"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useRoleChanged } from "@/lib/role-events";
import { getLatestCardDraftBatch, isBatchRunning, type CardDraftBatch } from "@/services/card-draft-batches";

/** The source of truth is the persisted batch, so leaving the drafting page never loses it. */
export function CardDraftBanner({ roleId, onReady }: { roleId: string; onReady?: () => void }) {
  const [batch, setBatch] = useState<CardDraftBatch | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const readyCallback = useRef(onReady);
  const notifiedSnapshot = useRef<string | null>(null);
  useRoleChanged(roleId, () => setReload((value) => value + 1));
  useEffect(() => { readyCallback.current = onReady; }, [onReady]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await getLatestCardDraftBatch(roleId, controller.signal);
        if (controller.signal.aborted) return;
        setBatch(next);
        setError(false);
        if (next && next.generatedCount > 0) {
          const snapshot = `${next.id}:${next.generatedCount}:${next.status}`;
          if (notifiedSnapshot.current !== snapshot) {
            notifiedSnapshot.current = snapshot;
            readyCallback.current?.();
          }
        }
        if (next && isBatchRunning(next)) timer = setTimeout(load, 2000);
      } catch {
        if (controller.signal.aborted) return;
        setError(true);
        timer = setTimeout(load, 5000);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [roleId, reload]);

  if (error && !batch) return <div role="status" className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-xs text-ink-muted"><span className="mr-auto">Couldn’t check your latest AI batch.</span><Button size="sm" onClick={() => setReload((value) => value + 1)}>Try again</Button></div>;
  if (!batch) return null;
  const running = isBatchRunning(batch);
  const drafts = batch.cards.filter((card) => card.status === "ai_draft").length;
  const remaining = Math.max(0, batch.requestedCount - batch.generatedCount);
  if (!running && drafts === 0 && remaining === 0 && batch.status !== "failed") return null;
  const title = running ? "Your AI batch is generating" : batch.status === "failed" ? "Your AI batch needs attention" : drafts > 0 ? "Your AI batch is ready to review" : batch.status === "stopped" ? "Your AI batch has been stopped" : "Your AI batch has cards left to generate";
  return <div className="flex w-full flex-wrap items-center gap-3 rounded-panel border border-primary-line bg-primary-tint px-4 py-3">
    <div className="mr-auto"><p className="m-0 text-[13px] font-semibold text-primary-text">{title}</p><p role="status" aria-live="polite" className="m-0 mt-0.5 text-xs leading-5 text-ink-muted">{running ? `${batch.generatedCount} of ${batch.requestedCount} saved. You can keep working while it runs.` : `${drafts} ${drafts === 1 ? "draft" : "drafts"} waiting for review${remaining ? ` · ${remaining} still to generate` : ""}. Candidates see cards after you approve them.`}{error ? " Progress is reconnecting." : ""}</p></div>
    <ButtonLink href={`/roles/${encodeURIComponent(roleId)}/cards/draft-ai?batch=${encodeURIComponent(batch.id)}`} size="sm" variant="secondary-teal">{running ? "View progress" : "Review batch"}</ButtonLink>
  </div>;
}
