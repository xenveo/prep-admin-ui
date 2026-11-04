"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { CARD_CATEGORY_LABEL, SAMPLE_OUTLINE_MAX_LENGTH, TIP_MAX_LENGTH } from "@/lib/types";
import type { BatchCard, CardDraftBatch } from "@/services/card-draft-batches";
import { CARD_CATEGORIES, cardIssues, nonempty, outlineSteps } from "./card-draft-utils";
import type { CardPatch } from "./use-draft-card-edits";

type Props = {
  batch: CardDraftBatch;
  cards: BatchCard[];
  busy: boolean;
  readOnly: boolean;
  statuses: Record<string, "saving" | "saved" | "error">;
  onEdit: (card: BatchCard, patch: CardPatch) => void;
  onSave: (cardId: string) => void;
  onApprove: (ids: string[]) => Promise<boolean>;
  onDiscard: (ids: string[]) => void;
  onRegenerate: (cardId: string) => void;
};

export function CardDraftReview({ batch, cards, busy, readOnly, statuses, onEdit, onSave, onApprove, onDiscard, onRegenerate }: Props) {
  const [openId, setOpenId] = useState<string | null>(cards[0]?.id ?? null);
  const [selection, setSelection] = useState<string[]>([]);
  const drafts = cards.filter((card) => card.status === "ai_draft");
  const selected = drafts.filter((card) => selection.includes(card.id));
  const approvable = selected.filter((card) => cardIssues(card).length === 0);
  const incomplete = selected.length - approvable.length;
  const allSelected = drafts.length > 0 && selected.length === drafts.length;
  const checked = allSelected ? true : selected.length ? "mixed" : false;
  const disabled = busy || readOnly;

  async function approve(ids: string[]) {
    if (await onApprove(ids)) setSelection((current) => current.filter((id) => !ids.includes(id)));
  }

  return (
    <section aria-labelledby="draft-review-heading" className="min-w-0 overflow-hidden rounded-panel border border-line bg-surface">
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-line px-4 py-3", selected.length > 0 && "bg-primary-tint")}>
        <Checkbox label="Select all AI drafts" checked={checked} disabled={disabled || drafts.length === 0} onChange={(next) => setSelection(next ? drafts.map((card) => card.id) : [])} />
        <div className="mr-auto"><h2 id="draft-review-heading" className="m-0 text-sm font-semibold text-ink">{cards.length} {cards.length === 1 ? "card" : "cards"} to review</h2><p className="m-0 mt-0.5 text-xs text-ink-faint">{cards.length - drafts.length > 0 ? `${cards.length - drafts.length} approved · ` : ""}{drafts.length} still AI drafts{selected.length ? ` · ${selected.length} selected` : ""}</p></div>
        {incomplete > 0 && <p role="status" className="m-0 max-w-60 text-xs leading-4 text-improve-text">{incomplete} selected {incomplete === 1 ? "card is" : "cards are"} incomplete and won’t be approved.</p>}
        <Button size="sm" disabled={disabled || selected.length === 0} onClick={() => onDiscard(selected.map((card) => card.id))} className="text-error">Discard selected{selected.length ? ` (${selected.length})` : ""}</Button>
        <Button size="sm" variant="primary" disabled={disabled || approvable.length === 0} onClick={() => { void approve(approvable.map((card) => card.id)); }}>Approve selected ({approvable.length})</Button>
      </div>

      {cards.length ? <ol className="m-0 list-none divide-y divide-line p-0">
        {cards.map((card, index) => {
          const issues = cardIssues(card);
          const approved = card.status === "approved";
          const expanded = openId === card.id;
          const regenerating = batch.regeneratingCardId === card.id && (batch.status === "queued" || batch.status === "running");
          const status = statuses[card.id];
          const panelId = `batch-card-${card.id}`;
          return <li key={card.id} className={cn(expanded && "bg-surface-sunken")}>
            <div className="grid grid-cols-[16px_20px_minmax(0,1fr)_28px] items-center gap-x-3 gap-y-2 px-4 py-3 min-[1250px]:grid-cols-[16px_20px_minmax(0,1fr)_130px_100px_100px_28px]">
              <Checkbox label={`Select card ${index + 1}`} checked={selection.includes(card.id) && !approved} disabled={disabled || approved} onChange={(next) => setSelection((current) => next ? [...current.filter((id) => id !== card.id), card.id] : current.filter((id) => id !== card.id))} />
              <span className="text-xs text-ink-faint" aria-hidden="true">{index + 1}</span>
              <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenId(expanded ? null : card.id)} className="focus-inset min-w-0 cursor-pointer rounded-sm text-left">
                <span className={cn("block truncate text-[13px] leading-5 text-ink", expanded ? "font-semibold" : "font-medium")}>{regenerating ? "Regenerating this card…" : card.question.trim() || "Untitled card"}</span>
                <span className="mt-1 block truncate text-xs text-ink-faint">{CARD_CATEGORY_LABEL[card.category]}{card.topic ? ` · ${card.topic}` : ""}</span>
              </button>
              <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} card ${index + 1}`} aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenId(expanded ? null : card.id)} className="focus-inset col-start-4 row-start-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-faint hover:bg-row-hover min-[1250px]:col-start-7">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("transition-transform duration-100 motion-reduce:transition-none", expanded && "rotate-180")}><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <span className={cn("col-start-3 text-xs leading-4 min-[1250px]:col-start-4 min-[1250px]:row-start-1", regenerating ? "text-ink-faint" : issues.length ? "text-improve-text" : "text-primary-text")}>
                {regenerating ? "Regenerating…" : issues.length ? `Needs ${issues.join(", ")}` : "✓ Complete"}
              </span>
              <div className="col-start-3 flex flex-wrap items-center gap-3 min-[1250px]:contents">
                <span className="min-[1250px]:col-start-5 min-[1250px]:row-start-1"><StatusChip status={approved ? "approved" : "ai-draft"} appearance="pill" /></span>
                <Button size="sm" disabled={disabled || approved || regenerating} onClick={() => onRegenerate(card.id)} className="h-7! px-2.5! text-xs! min-[1250px]:col-start-6 min-[1250px]:row-start-1">Regenerate</Button>
              </div>
            </div>

            {expanded && <div id={panelId} className="grid min-w-0 gap-6 px-4 pb-5 sm:pl-[76px] min-[1250px]:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-w-0 flex-col gap-4">
                <fieldset disabled={disabled || approved || regenerating} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className="mb-2 p-0 text-[13px] font-semibold text-ink">Category</legend>
                    <div className="flex flex-wrap gap-1.5">{CARD_CATEGORIES.map((category) => <label key={category} className={cn("focus-within:ring-2 focus-within:ring-primary-line inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", card.category === category ? "border-primary-line bg-primary-tint text-primary-text" : "border-line bg-surface text-ink-muted")}>
                      <input type="radio" name={`category-${card.id}`} value={category} checked={card.category === category} onChange={() => onEdit(card, { category })} className="sr-only" />{CARD_CATEGORY_LABEL[category]}
                    </label>)}</div>
                  </fieldset>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor={`question-${card.id}`}>
                    Question<Textarea id={`question-${card.id}`} rows={2} value={card.question} maxLength={500} invalid={!card.question.trim()} onChange={(event) => onEdit(card, { question: event.target.value })} onBlur={() => onSave(card.id)} className="min-h-0! font-normal" />
                  </label>
                  <StructuredList label="Strong-answer points" items={card.strongAnswerPoints} minimum={3} onChange={(strongAnswerPoints) => onEdit(card, { strongAnswerPoints })} onBlur={() => onSave(card.id)} tone="strong" />
                  <StructuredList label="Common mistakes" items={card.commonMistakes} minimum={2} onChange={(commonMistakes) => onEdit(card, { commonMistakes })} onBlur={() => onSave(card.id)} tone="mistake" />
                  <StructuredList label="Sample answer outline" items={outlineSteps(card.sampleAnswerOutline)} minimum={3} onChange={(steps) => onEdit(card, { sampleAnswerOutline: steps.join("\n") })} onBlur={() => onSave(card.id)} tone="outline" maxTotal={SAMPLE_OUTLINE_MAX_LENGTH} />
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor={`tip-${card.id}`}>
                    <span className="flex justify-between gap-2"><span>Tip</span><span className="text-xs font-normal text-ink-faint">{card.tip.length} / {TIP_MAX_LENGTH}</span></span>
                    <Input id={`tip-${card.id}`} value={card.tip} maxLength={TIP_MAX_LENGTH} invalid={!card.tip.trim()} onChange={(event) => onEdit(card, { tip: event.target.value })} onBlur={() => onSave(card.id)} className="h-9! text-[13px]! font-normal" />
                  </label>
                </fieldset>
                <div role="status" aria-live="polite" className={cn("flex flex-wrap items-center gap-2 text-xs", status === "error" ? "text-error" : "text-ink-faint")}>
                  {status === "error" ? <><span>Changes weren’t saved. Retry before approving.</span><Button size="sm" onClick={() => onSave(card.id)} disabled={disabled}>Retry save</Button></> : status === "saving" ? "Saving changes…" : approved ? "Approved · edit this card on the Flash cards tab." : "✓ Saved automatically · hidden from candidates until approved"}
                </div>
                {!approved && <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={disabled || regenerating} onClick={() => onDiscard([card.id])} className="text-error">Discard</Button>
                  <Button size="sm" disabled={disabled || regenerating} onClick={() => onRegenerate(card.id)}>Regenerate this card</Button>
                  <Button size="sm" variant="primary" disabled={disabled || regenerating || issues.length > 0} onClick={() => { void approve([card.id]); }}>Approve card</Button>
                </div>}
              </div>
              <CandidatePreview card={card} />
            </div>}
          </li>;
        })}
      </ol> : <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <h3 className="m-0 text-sm font-semibold text-ink">{batch.generatedCount > 0 ? "This batch is done." : "No cards saved yet."}</h3>
        <p className="m-0 text-[13px] text-ink-muted">{batch.discardedCount ? `${batch.discardedCount} ${batch.discardedCount === 1 ? "draft discarded" : "drafts discarded"}.` : "Try generating the remaining cards, or start a new batch."}</p>
      </div>}
    </section>
  );
}

function StructuredList({ label, items, minimum, onChange, onBlur, tone, maxTotal }: { label: string; items: string[]; minimum: number; onChange: (items: string[]) => void; onBlur: () => void; tone: "strong" | "mistake" | "outline"; maxTotal?: number }) {
  const [rowCount, setRowCount] = useState(Math.max(items.length, minimum));
  const rows = items.slice();
  while (rows.length < Math.max(minimum, rowCount)) rows.push("");
  const validCount = nonempty(items).length;
  const total = rows.join("\n").length;
  return <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
    <legend className="mb-2 flex w-full justify-between gap-2 p-0 text-[13px] font-semibold text-ink"><span>{label}</span><span className={cn("text-xs", validCount >= minimum && (!maxTotal || total <= maxTotal) ? "text-primary-text" : "text-improve-text")}>{validCount} of {minimum}{maxTotal ? ` · ${total} / ${maxTotal}` : ""}</span></legend>
    {rows.map((item, index) => <div key={index} className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className={cn("inline-flex h-9 w-4 shrink-0 items-center justify-center text-xs font-semibold", tone === "strong" ? "text-primary-text" : tone === "mistake" ? "text-improve-text" : "text-ink-muted")}>{tone === "outline" ? `${index + 1}.` : "•"}</span>
      <Input value={item} aria-label={`${label}, ${tone === "outline" ? "step" : "point"} ${index + 1}`} maxLength={tone === "outline" ? Math.max(0, (maxTotal ?? 1000) - (total - item.length)) : 500} invalid={!item.trim() || Boolean(maxTotal && total > maxTotal)} onChange={(event) => onChange(rows.map((row, i) => i === index ? event.target.value : row))} onBlur={onBlur} className="h-9! min-w-0 flex-1 text-[13px]!" />
    </div>)}
    {tone === "outline" && rows.length < 8 && <button type="button" onClick={() => setRowCount(rows.length + 1)} className="focus-inset mt-1 cursor-pointer self-start rounded-sm pl-6 text-xs font-semibold text-primary-text hover:underline">+ Add outline step</button>}
  </fieldset>;
}

function CandidatePreview({ card }: { card: BatchCard }) {
  return <aside aria-label="Candidate preview" className="flex min-w-0 flex-col gap-2 text-xs leading-[1.55]">
    <h3 className="m-0 text-xs font-semibold text-ink-faint">Candidate preview</h3>
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="self-start rounded-full bg-primary-tint px-2 py-1 text-[11px] font-semibold text-primary-text">{CARD_CATEGORY_LABEL[card.category]}</span>
      <p className="m-0 text-base leading-6 font-semibold text-ink wrap-anywhere">{card.question || "Your question appears here"}</p>
    </div>
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div><h4 className="m-0 text-xs font-semibold text-primary-text">A strong answer</h4><ul className="m-0 mt-1 list-disc space-y-1 pl-4 text-ink-soft">{nonempty(card.strongAnswerPoints).map((point, index) => <li key={index} className="wrap-anywhere">{point}</li>)}</ul></div>
      {card.tip.trim() && <p className="m-0 rounded-lg bg-primary-tint px-2.5 py-2 text-ink-soft wrap-anywhere"><strong className="font-semibold text-primary-text">Tip: </strong>{card.tip}</p>}
      <div><h4 className="m-0 text-xs font-semibold text-improve-text">Common mistakes</h4><ul className="m-0 mt-1 list-disc space-y-1 pl-4 text-ink-soft">{nonempty(card.commonMistakes).map((point, index) => <li key={index} className="wrap-anywhere">{point}</li>)}</ul></div>
      <div><h4 className="m-0 text-xs font-semibold text-ink">Sample answer outline</h4><ol className="m-0 mt-1 list-decimal space-y-1 pl-4 text-ink-soft">{nonempty(outlineSteps(card.sampleAnswerOutline)).map((point, index) => <li key={index} className="wrap-anywhere">{point.replace(/^\s*\d+[.)]\s*/, "")}</li>)}</ol></div>
    </div>
  </aside>;
}
