"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRole } from "@/features/roles/role-context";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CARD_CATEGORY_LABEL } from "@/lib/types";
import {
  approveBatchCards, discardBatchCards, fillCardDraftBatch, isBatchRunning,
  regenerateBatchCard, startCardDraftBatch, stopCardDraftBatch,
  type CardDraftBatch, type CardDraftInput,
} from "@/services/card-draft-batches";
import { CardDraftReview } from "./card-draft-review";
import { CardDraftSetup } from "./card-draft-setup";
import { useCardDraftBatch } from "./use-card-draft-batch";
import { useDraftCardEdits } from "./use-draft-card-edits";

type Confirmation = { kind: "stop" } | { kind: "discard"; ids: string[] };

export function CardDraftScreen({ roleId, batchId, fresh = false }: { roleId: string; batchId?: string; fresh?: boolean }) {
  const role = useRole();
  const router = useRouter();
  const state = useCardDraftBatch(roleId, batchId, fresh);
  const edits = useDraftCardEdits(roleId, state.batch, state.setBatch);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const batch = state.batch;
  const base = `/roles/${encodeURIComponent(roleId)}/cards`;
  const running = batch ? isBatchRunning(batch) : false;
  const busy = state.busy || navigationBusy;
  const readOnly = role.status === "archived";
  const remaining = batch ? Math.max(0, batch.requestedCount - batch.generatedCount) : 0;

  async function navigate(href: string) {
    if (busy) return;
    setNavigationBusy(true);
    setNavigationError(null);
    try {
      await edits.flush();
      router.push(href);
    } catch (cause) {
      setNavigationError(cause instanceof Error ? cause.message : "Save your changes before leaving this page.");
      setNavigationBusy(false);
    }
  }

  async function generate(input: CardDraftInput) {
    const created = await state.run(() => startCardDraftBatch(roleId, input));
    if (created) router.replace(`${base}/draft-ai?batch=${encodeURIComponent(created.id)}`);
  }

  async function approve(ids: string[]): Promise<boolean> {
    if (!batch) return false;
    const updated = await state.run(async () => {
      await edits.flush(ids);
      return approveBatchCards(roleId, batch.id, ids);
    });
    return Boolean(updated);
  }

  function regenerate(cardId: string) {
    if (!batch) return;
    const currentCard = edits.cards.find((card) => card.id === cardId);
    void (async () => {
      const next = await state.run(async () => {
        if (currentCard?.question.trim()) {
          try { await edits.flush([cardId]); }
          catch (cause) {
            if (!(cause instanceof ApiError && cause.code === "validation_failed")) throw cause;
          }
        }
        // Replacing a draft must also work when its local question cannot be saved.
        await edits.settle([cardId]);
        return regenerateBatchCard(roleId, batch.id, cardId);
      });
      if (next) edits.forget([cardId]);
      else edits.resume([cardId]);
    })();
  }

  async function confirm() {
    if (!batch || !confirmation || busy) return;
    const action = confirmation;
    setConfirmation(null);
    const next = await state.run(async () => {
      if (action.kind === "stop") return stopCardDraftBatch(roleId, batch.id);
      // Deletion intentionally drops local edits, including fields the save API rejects.
      await edits.settle(action.ids);
      return discardBatchCards(roleId, batch.id, action.ids);
    });
    if (action.kind === "discard") {
      if (next) edits.forget(action.ids);
      else edits.resume(action.ids);
    }
  }

  return <div className="flex min-w-0 flex-col gap-5">
    <PageHeader className="mb-0! gap-4!" title="Draft flash cards with AI" titleSize="md"
      breadcrumb={[{ label: "Job roles", href: "/roles" }, { label: role.title, href: `/roles/${encodeURIComponent(roleId)}/details` }, { label: "Flash cards", href: base }, { label: "Draft with AI" }]}
      description="New cards are saved as AI drafts as soon as they’re generated. Candidates don’t see them until you approve them."
      secondaryActions={<Button disabled={busy} onClick={() => { void navigate(base); }}>Back to flash cards</Button>} />

    {(state.error || navigationError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-improve bg-improve-soft px-4 py-3 text-sm text-improve-text">
      <p className="m-0">{navigationError ?? state.error}</p>
      {state.conflictBatchId && <ButtonLink size="sm" href={`${base}/draft-ai?batch=${encodeURIComponent(state.conflictBatchId)}`}>Open existing batch</ButtonLink>}
      {!batch && !fresh && <Button size="sm" disabled={busy} onClick={state.reload}>Try again</Button>}
    </div>}
    {state.pollError && <div role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-muted">Progress couldn’t be refreshed. Reconnecting automatically; your batch keeps running.</div>}

    {state.loading ? <div aria-label="Loading drafting page" aria-busy="true" className="grid gap-5 min-[1150px]:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-6 rounded-panel border border-line bg-surface p-6"><div className="h-5 w-40 rounded bg-neutral-soft" /><div className="h-10 w-64 max-w-full rounded bg-neutral-soft" /><div className="h-5 w-24 rounded bg-neutral-soft" /><div className="h-24 rounded bg-neutral-soft" /><div className="h-28 rounded bg-neutral-soft" /></div><div className="h-80 rounded-panel border border-line bg-surface" />
    </div> : !batch ? <CardDraftSetup role={role} busy={busy} onGenerate={(input) => { void generate(input); }} /> : <>
      <BatchStatus batch={batch} />
      {running && !batch.regeneratingCardId && <GenerationProgress batch={batch} busy={busy} readOnly={readOnly} onStop={() => setConfirmation({ kind: "stop" })} onBack={() => { void navigate(base); }} />}
      {running && batch.regeneratingCardId && <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-line bg-primary-tint px-4 py-3 text-[13px] text-primary-text">
        <p className="m-0 mr-auto">Regenerating the selected card. Its current content is kept until a complete replacement is ready.</p><Button size="sm" disabled={busy || readOnly} onClick={() => setConfirmation({ kind: "stop" })}>Stop generating</Button>
      </div>}
      {!running && batch.status === "failed" && <div role="alert" className="rounded-lg border border-improve bg-improve-soft px-4 py-3 text-sm leading-6 text-improve-text">AI couldn’t complete this request. Saved cards and their current content are preserved. Try Regenerate again, or generate any remaining cards.</div>}
      {!running && batch.status === "stopped" && <p role="status" className="m-0 text-sm text-ink-muted">Generation stopped. The {batch.generatedCount} {batch.generatedCount === 1 ? "card already saved stays" : "cards already saved stay"} as AI drafts unless you’ve approved them.</p>}
      {!running && remaining > 0 && !readOnly && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-improve bg-improve-soft px-4 py-3">
        <div className="mr-auto text-[13px] leading-5"><p className="m-0 font-semibold text-ink">{batch.generatedCount} of {batch.requestedCount} cards generated.</p><p className="m-0 text-ink-muted">{batch.duplicateCount > 0 ? `${batch.duplicateCount} ${batch.duplicateCount === 1 ? "response was" : "responses were"} too similar to existing cards and left out. ` : ""}Generate the remaining cards with the same topics and guidance.</p></div>
        <Button size="sm" disabled={busy} onClick={() => { void state.run(async () => { await edits.flush(); return fillCardDraftBatch(roleId, batch.id); }); }}>Generate the remaining {remaining}</Button>
      </div>}
      {(!running || Boolean(batch.regeneratingCardId)) && <>
        <CardDraftReview key={batch.id} batch={batch} cards={edits.cards} busy={busy || running} readOnly={readOnly} statuses={edits.statuses} onEdit={edits.edit} onSave={(cardId) => { void edits.persist(cardId).catch(() => {}); }} onApprove={approve} onDiscard={(ids) => setConfirmation({ kind: "discard", ids })} onRegenerate={regenerate} />
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="m-0 max-w-[660px] text-xs leading-5 text-ink-faint">Approved cards join the role’s card list in this order. Unreviewed cards stay as AI drafts on the Flash cards tab.</p><Button disabled={busy || running || readOnly} onClick={() => { void navigate(`${base}/draft-ai?new=1`); }}>Draft a new batch</Button></div>
      </>}
      {readOnly && <p role="status" className="m-0 text-sm text-improve-text">This role is archived. Its content is read-only.</p>}
    </>}

    <ConfirmDialog open={confirmation !== null} title={confirmation?.kind === "stop" ? "Stop generating?" : `Discard ${confirmation?.kind === "discard" ? confirmation.ids.length : ""} ${confirmation?.kind === "discard" && confirmation.ids.length === 1 ? "AI draft" : "AI drafts"}?`}
      body={confirmation?.kind === "stop" ? "Cards already saved stay as AI drafts. The rest of this batch won’t be created." : "These drafts will be deleted and never shown to candidates. This can’t be undone, but you can generate more later."}
      confirmLabel={confirmation?.kind === "stop" ? "Stop generating" : "Discard drafts"} cancelLabel={confirmation?.kind === "stop" ? "Keep generating" : "Cancel"}
      tone={confirmation?.kind === "discard" ? "destructive" : "default"} onConfirm={() => { void confirm(); }} onCancel={() => setConfirmation(null)} />
  </div>;
}

function BatchStatus({ batch }: { batch: CardDraftBatch }) {
  const active = batch.status === "queued" ? 0 : batch.status === "running" ? 1 : 2;
  const labels = ["Queued", "Generating", batch.status === "failed" ? "Needs attention" : batch.status === "stopped" ? "Stopped" : "Ready to review"];
  return <section aria-label="Batch status" className="rounded-panel border border-line bg-surface px-5 py-4">
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-6 gap-y-3 p-0" aria-label="Generation progress">
      {labels.map((label, index) => <li key={index} aria-current={index === active ? "step" : undefined} className={cn("flex items-center gap-2 text-xs font-medium sm:text-[13px]", index <= active ? "text-primary-text" : "text-ink-faint")}><span aria-hidden="true" className={cn("inline-flex size-6 items-center justify-center rounded-full border text-xs", index < active ? "border-primary bg-primary text-on-primary" : index === active ? "border-primary-line bg-primary-tint" : "border-neutral-line")}>{index < active ? "✓" : index + 1}</span>{label}</li>)}
    </ol>
    <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-5 text-ink-faint"><span>{batch.requestedCount} cards · {batch.categoryMix === "balanced" ? "Balanced mix" : "Custom mix"} · {batch.topics.length ? `${batch.topics.length} topics` : "Whole role description"}</span><span>Started {new Date(batch.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{batch.createdByName ? ` by ${batch.createdByName}` : ""}</span></div>
  </section>;
}

function GenerationProgress({ batch, busy, readOnly, onStop, onBack }: { batch: CardDraftBatch; busy: boolean; readOnly: boolean; onStop: () => void; onBack: () => void }) {
  const count = batch.requestedCount;
  const generated = Math.min(count, batch.generatedCount);
  return <section aria-labelledby="generation-heading" className="overflow-hidden rounded-panel border border-line bg-surface">
    <div className="flex flex-col gap-3 border-b border-line p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="generation-heading" className="m-0 text-base font-semibold text-ink">Generating {count} cards</h2><span role="status" aria-live="polite" className="text-[13px] font-semibold text-primary-text">{generated} of {count} ready</span></div>
      <div role="progressbar" aria-label="Cards saved as drafts" aria-valuemin={0} aria-valuemax={count} aria-valuenow={generated} className="h-1.5 overflow-hidden rounded-full bg-neutral-soft"><div className="h-full origin-left rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `scaleX(${generated / count})` }} /></div>
      <p className="m-0 text-[13px] leading-5 text-ink-muted">You can leave this page. The batch keeps running and shows up on the Flash cards tab when it’s ready to review.</p>
    </div>
    <ol className="m-0 list-none divide-y divide-line p-0">{Array.from({ length: count }, (_, index) => {
      const card = batch.cards[index];
      const saved = index < generated;
      return <li key={index} className="flex items-center gap-4 px-5 py-3"><span className="w-4 shrink-0 text-xs text-ink-faint">{index + 1}</span><div className="mr-auto min-w-0 flex-1">{saved ? <><p className="m-0 truncate text-[13px] font-medium text-ink">{card?.question ?? "Draft discarded"}</p>{card && <p className="m-0 mt-1 truncate text-xs text-ink-faint">{CARD_CATEGORY_LABEL[card.category]}{card.topic ? ` · ${card.topic}` : ""}</p>}</> : <div aria-hidden="true" className="flex max-w-80 flex-col gap-2 py-1"><div className="h-3 w-full rounded-sm bg-neutral-soft" /><div className="h-2.5 w-2/3 rounded-sm bg-neutral-soft" /></div>}</div><span className={cn("shrink-0 text-xs", saved ? "text-primary-text" : "text-ink-faint")}>{saved ? !card ? "Discarded" : card.status === "approved" ? "Approved" : "Saved as AI draft" : batch.status === "queued" ? "Queued" : "Generating…"}</span></li>;
    })}</ol>
    <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4"><Button disabled={busy} onClick={onBack}>Back to flash cards</Button><Button disabled={busy || readOnly} onClick={onStop}>Stop generating</Button></div>
  </section>;
}
