"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BulletListEditor } from "@/components/ui/bullet-list-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { ReorderableList } from "@/components/ui/reorderable-list";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { FlashCardPreview } from "@/components/media/flash-card-preview";
import { cn } from "@/lib/cn";
import { emitRoleChanged } from "@/lib/role-events";
import { useRole } from "@/features/roles/role-context";
import {
  approveFlashCard,
  discardFlashCard,
  draftFlashCardsWithAI,
  listFlashCards,
  reorderFlashCards,
  saveFlashCard,
} from "@/services/roles";
import {
  CARD_CATEGORY_LABEL,
  SAMPLE_OUTLINE_MAX_LENGTH,
  TIP_MAX_LENGTH,
  type CardCategory,
  type FlashCard,
} from "@/lib/types";

const CATEGORIES = Object.keys(CARD_CATEGORY_LABEL) as CardCategory[];
type EditableFields = Pick<
  FlashCard,
  "category" | "question" | "strongAnswerPoints" | "tip" | "commonMistakes" | "sampleAnswerOutline"
>;
type PreviewSide = "front" | "back";
/** Design list-footer button: 9px radius, 9px × 14px padding, 13px semibold. */
const LIST_BUTTON = "h-auto! gap-1.5! rounded-[9px]! px-3.5! py-[9px]! font-semibold!";

export function CardsScreen({ roleId }: { roleId: string }) {
  const toast = useToast();
  const [cards, setCards] = useState<FlashCard[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [drafting, setDrafting] = useState(false);
  const draftAbort = useRef<AbortController | null>(null);
  const [newQuestion, setNewQuestion] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("front");
  const [busy, setBusy] = useState(false);
  const saves = useRef(new Map<string, Promise<void>>());
  const cardsRef = useRef<FlashCard[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const focusQuestion = useRef(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const role = useRole();

  const commit = useCallback((next: FlashCard[]) => {
    cardsRef.current = next;
    setCards(next);
  }, []);

  const fetchCards = useCallback(() => {
    listFlashCards(roleId).then(
      (list) => {
        cardsRef.current = list;
        setCards(list);
      },
      () => setError(true),
    );
  }, [roleId]);

  const load = useCallback(() => {
    setError(false);
    setCards(null);
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    fetchCards();
    return () => draftAbort.current?.abort();
  }, [fetchCards]);

  const persist = useCallback(
    async function persistCard(id: string): Promise<void> {
      timers.current.delete(id);
      const c = cardsRef.current.find((x) => x.id === id);
      if (!c) return;
      setSaveState("saving");
      try {
        const previous = saves.current.get(id) ?? Promise.resolve();
        const operation = previous.catch(() => {}).then(async () => {
          await saveFlashCard(roleId, {
            roleId, id: c.id, category: c.category, question: c.question,
            strongAnswerPoints: c.strongAnswerPoints.filter((s) => s.trim()), tip: c.tip,
            commonMistakes: c.commonMistakes.filter((s) => s.trim()),
            sampleAnswerOutline: c.sampleAnswerOutline?.trim() || null,
          });
        });
        saves.current.set(id, operation);
        await operation;
        setSaveState("saved");
        emitRoleChanged(roleId);
      } catch (error) {
        setSaveState("error");
        toast.show({
          title: "Card changes weren't saved",
          detail: error instanceof Error ? error.message : "Try again.",
          action: { label: "Retry save", onClick: () => { void persistCard(id).catch(() => {}); } },
        });
        throw error;
      }
    },
    [roleId, toast],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        // Keep the final edit behind earlier saves for this card. persist captures
        // its latest fields now and reports a failure through the shared toast.
        void persist(id).catch(() => {});
      }
      map.clear();
    };
  }, [persist]);

  const selected = cards?.find((c) => c.id === selectedId) ?? cards?.[0];

  useEffect(() => {
    if (focusQuestion.current && questionRef.current) {
      focusQuestion.current = false;
      questionRef.current.focus();
    }
  });

  function select(id: string | undefined) {
    setSelectedId(id);
    setPreviewSide("front");
  }

  function edit(patch: Partial<EditableFields>) {
    if (!selected) return;
    const id = selected.id;
    commit(cardsRef.current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSaveState("saving");
    const prev = timers.current.get(id);
    if (prev) clearTimeout(prev);
    timers.current.set(id, setTimeout(() => { void persist(id).catch(() => {}); }, 600));
  }

  async function flush(id: string) {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      await persist(id);
    }
    await saves.current.get(id);
  }

  async function addCard() {
    if (!newQuestion?.trim()) return;
    setAdding(true);
    try {
      const card = await saveFlashCard(roleId, {
        roleId,
        category: "behavioural",
        question: newQuestion.trim(),
        strongAnswerPoints: [],
        tip: "",
        commonMistakes: [],
        sampleAnswerOutline: null,
        status: "approved",
      });
      setNewQuestion(null);
      commit([...cardsRef.current, card]);
      select(card.id);
      focusQuestion.current = true;
      emitRoleChanged(roleId);
    } catch {
      toast.show({ title: "Couldn't add the card", detail: "Try again." });
    } finally {
      setAdding(false);
    }
  }

  async function draftMore() {
    setDrafting(true);
    draftAbort.current?.abort();
    const controller = new AbortController();
    draftAbort.current = controller;
    try {
      const created = await draftFlashCardsWithAI(roleId, controller.signal);
      commit([...cardsRef.current, ...created]);
      if (created[0]) select(created[0].id);
      emitRoleChanged(roleId);
      toast.show({
        title: `${created.length} AI drafts added`,
        detail: "Review and approve them before candidates see them.",
      });
    } catch (error) {
      if (!controller.signal.aborted) toast.show({ title: "Couldn't draft cards", detail: error instanceof Error ? error.message : "Try again." });
    } finally {
      if (!controller.signal.aborted) setDrafting(false);
    }
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    try {
      await flush(selected.id);
      const updated = await approveFlashCard(selected.id);
      commit(cardsRef.current.map((c) => (c.id === updated.id ? { ...c, status: updated.status } : c)));
      emitRoleChanged(roleId);
      toast.show({ title: "Card approved" });
    } catch {
      toast.show({ title: "Couldn't approve the card", detail: "Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    const id = selected.id;
    const wasDraft = selected.status === "ai_draft";
    setDeleteOpen(false);
    setBusy(true);
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    try {
      await discardFlashCard(id);
      const idx = cardsRef.current.findIndex((c) => c.id === id);
      const next = cardsRef.current.filter((c) => c.id !== id).map((c, i) => ({ ...c, position: i + 1 }));
      commit(next);
      select(next[Math.min(idx, next.length - 1)]?.id);
      emitRoleChanged(roleId);
      toast.show({ title: wasDraft ? "AI draft discarded" : "Card deleted" });
    } catch {
      toast.show({ title: wasDraft ? "Couldn't discard the card" : "Couldn't delete the card", detail: "Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function reorder(next: FlashCard[]) {
    setBusy(true);
    try {
      const saved = await reorderFlashCards(roleId, next.map((c) => c.id));
      commit(saved);
    } catch (error) {
      toast.show({title: "Couldn't reorder cards",detail:error instanceof Error ? error.message : "Try again."});
    } finally { setBusy(false); }
  }

  const createDialog = <Modal open={newQuestion !== null} title="New flash card" onClose={() => { if (!adding) setNewQuestion(null); }} footer={<><Button disabled={adding} onClick={()=>setNewQuestion(null)}>Cancel</Button><Button variant="primary" disabled={adding || !newQuestion?.trim()} onClick={addCard}>{adding ? "Creating…" : "Create card"}</Button></>}>
    <label className="flex flex-col gap-1"><span className="text-sm font-semibold">Question</span><Textarea rows={3} value={newQuestion ?? ""} onChange={(e)=>setNewQuestion(e.target.value)} /></label>
    <p className="text-xs text-ink-muted">Add answer points and a tip after creating the card.</p>
  </Modal>;

  if (error) {
    return (
      <EmptyState
        icon="alert"
        title="Couldn't load flash cards"
        description="Check your connection and try again."
        action={<Button variant="primary" onClick={load}>Try again</Button>}
      />
    );
  }
  if (cards === null) return <CardsSkeleton />;

  if (cards.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        {createDialog}
        <EmptyState
          icon="file"
          title="No flash cards yet"
          description="Flash cards are what candidates study before a mock interview. Add your own or let AI draft a first set from the role description."
          action={
            <div className="flex gap-2">
              <Button onClick={()=>setNewQuestion("")} disabled={adding}>+ Add card</Button>
              <Button variant="secondary-teal" onClick={draftMore} disabled={drafting} aria-busy={drafting}>
                <span aria-hidden="true">✦</span>
                {drafting ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>
          }
          helper="AI drafts are labelled and stay hidden from candidates until you approve them."
        />
      </div>
    );
  }

  const index = selected ? cards.findIndex((c) => c.id === selected.id) : 0;
  const isDraft = selected?.status === "ai_draft";
  const tipLength = selected?.tip.length ?? 0;
  const outlineLength = (selected?.sampleAnswerOutline ?? "").length;
  const questionMissing = selected ? !selected.question.trim() : false;
  const liveNote = isDraft
    ? "AI draft, hidden from candidates until you approve it"
    : role.status === "approved"
      ? "live for candidates because this role is approved"
      : role.status === "archived"
        ? "this role is archived, so candidates don’t see it"
        : "candidates see it once this role is approved";

  return (
    <div className="flex flex-wrap items-start gap-5">
      {createDialog}
      <section
        aria-labelledby="cards-h"
        className="flex max-w-[380px] min-w-0 flex-[1_1_300px] flex-col overflow-hidden rounded-panel border border-line bg-surface"
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3.5">
          <h2 id="cards-h" className="m-0 text-sm font-semibold text-ink">
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </h2>
          <span className="text-xs text-ink-faint">Shown to candidates in this order</span>
        </div>
        <ReorderableList
          items={cards}
          itemId={(c) => c.id}
          onReorder={reorder}
          selectedId={selected?.id}
          onSelect={select}
          ariaLabel="Flash cards"
          itemLabel={(c, i) => `Card ${i + 1}`}
          renderItem={(c, { index: i, selected: sel, handle }) => (
            <div
              className={cn(
                "grid cursor-pointer grid-cols-[12px_20px_minmax(0,1fr)] items-start gap-2 py-3 pr-3.5 pl-2.5 transition-colors duration-100",
                sel ? "bg-row-hover shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-row-hover",
              )}
            >
              {handle}
              <span aria-hidden="true" className="font-mono text-xs leading-5 text-ink-faint">
                {i + 1}
              </span>
              <button
                type="button"
                aria-current={sel ? "true" : undefined}
                onClick={() => select(c.id)}
                className="focus-inset flex min-w-0 cursor-pointer flex-col gap-[5px] rounded-sm text-left"
              >
                <span
                  className={cn(
                    "text-[13px] leading-[1.45] text-pretty text-ink",
                    sel ? "font-semibold" : "font-medium",
                    !c.question.trim() && "text-ink-faint",
                  )}
                >
                  <span className="sr-only">Card {i + 1}: </span>
                  {c.question.trim() || "Untitled card"}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  {CARD_CATEGORY_LABEL[c.category]}
                  {c.status === "ai_draft" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-improve-soft px-1.5 text-[11px] leading-[18px] font-semibold text-improve-text">
                      <span aria-hidden="true" className="size-1 rounded-full bg-improve" />
                      AI draft
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          )}
        />
        <div className="flex flex-wrap gap-2 border-t border-line p-3">
          <Button size="sm" onClick={() => setNewQuestion("")} disabled={adding} className={cn(LIST_BUTTON, "border-neutral-line!")}>
            + Add card
          </Button>
          <Button size="sm" variant="secondary-teal" onClick={draftMore} disabled={drafting} aria-busy={drafting} className={LIST_BUTTON}>
            <span aria-hidden="true">✦</span>
            {drafting ? "Drafting…" : "Draft more with AI"}
          </Button>
        </div>
      </section>

      {selected ? (
        <section
          aria-labelledby="ed-h"
          className="flex min-w-0 flex-[999_1_440px] flex-col overflow-hidden rounded-panel border border-line bg-surface"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="flex items-center gap-2">
              <h2 id="ed-h" className="m-0 text-sm font-semibold text-ink">Card {index + 1}</h2>
              {isDraft ? <StatusChip status="ai-draft" /> : null}
            </span>
            <button
              ref={deleteRef}
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
              className="relative cursor-pointer rounded-sm text-[13px] font-semibold text-ink-faint transition-colors duration-100 after:absolute after:-inset-2 after:content-[''] hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete card
            </button>
          </div>
          <div className="flex flex-col gap-[22px] p-5">
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-ink">Category</legend>
              <CategoryRadios value={selected.category} onChange={(category) => edit({ category })} />
            </fieldset>
            <div className="flex flex-col gap-2">
              <label htmlFor="card-question" className="text-sm font-semibold text-ink">
                Question
              </label>
              <Textarea
                id="card-question"
                ref={questionRef}
                rows={2}
                value={selected.question}
                invalid={questionMissing}
                aria-describedby={questionMissing ? "card-question-error" : undefined}
                onChange={(e) => edit({ question: e.target.value })}
                onBlur={() => { void flush(selected.id).catch(() => {}); }}
                className="min-h-0! rounded-[9px]! text-[15px]!"
              />
              {questionMissing ? (
                <span id="card-question-error" className="text-xs text-improve-text">
                  Add a question. Candidates see it on the front of the card.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <span aria-hidden="true" className="text-sm font-semibold text-primary-text">
                What a strong answer includes
              </span>
              <BulletListEditor
                tone="strong"
                label="What a strong answer includes"
                items={selected.strongAnswerPoints}
                onChange={(strongAnswerPoints) => edit({ strongAnswerPoints })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span aria-hidden="true" className="text-sm font-semibold text-improve-text">
                Common mistakes
              </span>
              <BulletListEditor
                tone="mistake"
                label="Common mistakes"
                itemLabel="mistake"
                addLabel="+ Add mistake"
                items={selected.commonMistakes}
                onChange={(commonMistakes) => edit({ commonMistakes })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between gap-3">
                <label htmlFor="card-tip" className="text-sm font-semibold text-ink">
                  Tip
                </label>
                <span
                  id="card-tip-count"
                  className={cn("text-xs", tipLength > TIP_MAX_LENGTH - 10 ? "text-improve-text" : "text-ink-faint")}
                >
                  {tipLength} / {TIP_MAX_LENGTH}
                </span>
              </span>
              <Input
                id="card-tip"
                value={selected.tip}
                maxLength={TIP_MAX_LENGTH}
                aria-describedby="card-tip-count"
                onChange={(e) => edit({ tip: e.target.value })}
                onBlur={() => { void flush(selected.id).catch(() => {}); }}
                className="h-10!"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between gap-3">
                <label htmlFor="card-outline" className="text-sm font-semibold text-ink">
                  Sample answer outline
                </label>
                <span id="card-outline-count" className="text-xs text-ink-faint">
                  Optional · {outlineLength} / {SAMPLE_OUTLINE_MAX_LENGTH}
                </span>
              </span>
              <Textarea
                id="card-outline"
                rows={3}
                value={selected.sampleAnswerOutline ?? ""}
                maxLength={SAMPLE_OUTLINE_MAX_LENGTH}
                placeholder="A short outline of a strong answer, shown after the candidate practises"
                aria-describedby="card-outline-count"
                onChange={(e) => edit({ sampleAnswerOutline: e.target.value })}
                onBlur={() => { void flush(selected.id).catch(() => {}); }}
                className="min-h-0! rounded-[9px]!"
              />
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-faint">
            <span role="status" aria-live="polite" className={cn("mr-auto", saveState === "error" && "text-error")}>
              {saveState === "saving" ? (
                "Saving…"
              ) : saveState === "error" ? (
                "Changes not saved"
              ) : (
                <>
                  <span aria-hidden="true">✓ </span>Saved automatically ·{" "}
                  <span className={cn(isDraft && "text-ai-text")}>{liveNote}</span>
                </>
              )}
            </span>
            {saveState === "error" ? (
              <Button size="sm" onClick={() => { void persist(selected.id).catch(() => {}); }}>
                Retry save
              </Button>
            ) : null}
            {isDraft ? (
              <Button size="sm" variant="primary" onClick={approve} disabled={busy}>
                Approve card
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {selected ? (
        <aside aria-labelledby="pv-h" className="flex max-w-[380px] min-w-0 flex-[1_1_300px] flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pv-h" className="m-0 text-sm font-semibold text-ink">Candidate preview</h2>
            <SegmentedControl<PreviewSide>
              size="sm"
              label="Preview side"
              value={previewSide}
              onChange={setPreviewSide}
              options={[
                { value: "front", label: "Front" },
                { value: "back", label: "Back" },
              ]}
            />
          </div>
          <FlashCardPreview
            variant="panel"
            side={previewSide}
            onSideChange={setPreviewSide}
            category={CARD_CATEGORY_LABEL[selected.category]}
            question={selected.question.trim() || "Your question appears here"}
            strong={selected.strongAnswerPoints}
            tip={selected.tip}
            mistakes={selected.commonMistakes}
            outline={selected.sampleAnswerOutline}
            index={index + 1}
            total={cards.length}
          />
        </aside>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title={isDraft ? "Discard this AI draft?" : `Delete card ${index + 1}?`}
        body={
          isDraft
            ? "The card is deleted and never shown to candidates. This can’t be undone, but you can draft more with AI later."
            : "Candidates will no longer see this card. This can’t be undone."
        }
        confirmLabel={isDraft ? "Discard card" : "Delete card"}
        tone="destructive"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        returnFocusRef={deleteRef}
      />
    </div>
  );
}

function CategoryRadios({ value, onChange }: { value: CardCategory; onChange: (v: CardCategory) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(e: React.KeyboardEvent) {
    const i = CATEGORIES.indexOf(value);
    let n = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % CATEGORIES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + CATEGORIES.length) % CATEGORIES.length;
    else return;
    e.preventDefault();
    onChange(CATEGORIES[n]);
    ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[n]?.focus();
  }
  return (
    <div ref={ref} role="radiogroup" aria-label="Category" onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((k) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(k)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors duration-100",
              on
                ? "border-primary-line bg-primary-tint text-primary-text"
                : "border-input-line bg-transparent text-ink-muted hover:border-neutral-line hover:text-ink",
            )}
          >
            {CARD_CATEGORY_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="flex flex-wrap items-start gap-5" aria-busy="true" aria-label="Loading flash cards">
      <div className="h-[480px] max-w-[380px] min-w-0 flex-[1_1_300px] animate-pulse rounded-panel border border-line bg-neutral-soft" />
      <div className="h-[640px] min-w-0 flex-[999_1_440px] animate-pulse rounded-panel border border-line bg-neutral-soft" />
      <div className="h-[380px] max-w-[380px] min-w-0 flex-[1_1_300px] animate-pulse rounded-2xl border border-line bg-neutral-soft" />
    </div>
  );
}
