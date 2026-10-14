"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BulletListEditor } from "@/components/ui/bullet-list-editor";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ReorderableList } from "@/components/ui/reorderable-list";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { FlashCardPreview } from "@/components/media/flash-card-preview";
import { cn } from "@/lib/cn";
import { emitRoleChanged } from "@/lib/role-events";
import {
  approveFlashCard,
  discardFlashCard,
  draftFlashCardsWithAI,
  listFlashCards,
  reorderFlashCards,
  saveFlashCard,
} from "@/services/roles";
import { CARD_CATEGORY_LABEL, TIP_MAX_LENGTH, type CardCategory, type FlashCard } from "@/lib/types";

const CATEGORIES = Object.keys(CARD_CATEGORY_LABEL) as CardCategory[];
type EditableFields = Pick<FlashCard, "category" | "question" | "strongAnswerPoints" | "tip" | "commonMistakes">;

export function CardsScreen({ roleId }: { roleId: string }) {
  const toast = useToast();
  const [cards, setCards] = useState<FlashCard[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [drafting, setDrafting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardsRef = useRef<FlashCard[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const focusQuestion = useRef(false);
  const discardRef = useRef<HTMLButtonElement>(null);

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
  }, [fetchCards]);

  const persist = useCallback(
    (id: string) => {
      timers.current.delete(id);
      const c = cardsRef.current.find((x) => x.id === id);
      if (!c) return;
      setSaveState("saving");
      saveFlashCard(roleId, {
        roleId,
        id: c.id,
        category: c.category,
        question: c.question,
        strongAnswerPoints: c.strongAnswerPoints,
        tip: c.tip,
        commonMistakes: c.commonMistakes,
      }).then(
        () => setSaveState("saved"),
        () => setSaveState("idle"),
      );
    },
    [roleId],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        const c = cardsRef.current.find((x) => x.id === id);
        if (c)
          void saveFlashCard(roleId, {
            roleId,
            id: c.id,
            category: c.category,
            question: c.question,
            strongAnswerPoints: c.strongAnswerPoints,
            tip: c.tip,
            commonMistakes: c.commonMistakes,
          });
      }
      map.clear();
    };
  }, [roleId]);

  const selected = cards?.find((c) => c.id === selectedId) ?? cards?.[0];

  useEffect(() => {
    if (focusQuestion.current && questionRef.current) {
      focusQuestion.current = false;
      questionRef.current.focus();
    }
  });

  function edit(patch: Partial<EditableFields>) {
    if (!selected) return;
    const id = selected.id;
    commit(cardsRef.current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSaveState("saving");
    const prev = timers.current.get(id);
    if (prev) clearTimeout(prev);
    timers.current.set(id, setTimeout(() => persist(id), 600));
  }

  function flush(id: string) {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      persist(id);
    }
  }

  async function addCard() {
    setAdding(true);
    try {
      const card = await saveFlashCard(roleId, {
        roleId,
        category: "behavioural",
        question: "",
        strongAnswerPoints: [""],
        tip: "",
        commonMistakes: [""],
        status: "approved",
      });
      commit([...cardsRef.current, card]);
      setSelectedId(card.id);
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
    try {
      const created = await draftFlashCardsWithAI(roleId);
      commit([...cardsRef.current, ...created]);
      if (created[0]) setSelectedId(created[0].id);
      emitRoleChanged(roleId);
      toast.show({
        title: `${created.length} AI drafts added`,
        detail: "Review and approve them before candidates see them.",
      });
    } catch {
      toast.show({ title: "Couldn't draft cards", detail: "Try again in a moment." });
    } finally {
      setDrafting(false);
    }
  }

  async function approve() {
    if (!selected) return;
    flush(selected.id);
    setBusy(true);
    try {
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

  async function discard() {
    if (!selected) return;
    const id = selected.id;
    setDiscardOpen(false);
    setBusy(true);
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    try {
      await discardFlashCard(id);
      const idx = cardsRef.current.findIndex((c) => c.id === id);
      const next = cardsRef.current.filter((c) => c.id !== id).map((c, i) => ({ ...c, position: i + 1 }));
      commit(next);
      setSelectedId(next[Math.min(idx, next.length - 1)]?.id);
      emitRoleChanged(roleId);
      toast.show({ title: "AI draft discarded" });
    } catch {
      toast.show({ title: "Couldn't discard the card", detail: "Try again." });
    } finally {
      setBusy(false);
    }
  }

  function reorder(next: FlashCard[]) {
    commit(next.map((c, i) => ({ ...c, position: i + 1 })));
    void reorderFlashCards(
      roleId,
      next.map((c) => c.id),
    );
  }

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
      <div className="rounded-lg border border-line bg-surface">
        <EmptyState
          icon="file"
          title="No flash cards yet"
          description="Flash cards are what candidates study before a mock interview. Add your own or let AI draft a first set from the role description."
          action={
            <div className="flex gap-2">
              <Button onClick={addCard} disabled={adding}>+ Add card</Button>
              <Button variant="secondary-teal" iconLeft="sparkle" onClick={draftMore} disabled={drafting}>
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

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section aria-labelledby="cards-h" className="flex max-w-full flex-[0_0_320px] flex-col rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-line py-3 pr-3 pl-4">
          <h2 id="cards-h" className="m-0 text-sm leading-5 font-semibold text-ink">
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </h2>
          <span className="text-xs leading-4 text-ink-muted">Shown to candidates in this order</span>
        </div>
        <div className="p-2">
          <ReorderableList
            items={cards}
            itemId={(c) => c.id}
            onReorder={reorder}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            ariaLabel="Flash cards"
            itemLabel={(c, i) => `Card ${i + 1}`}
            renderItem={(c, { index: i, selected: sel, handle }) => (
              <div
                className={cn(
                  "flex min-h-[52px] items-center gap-1 rounded-md py-1.5 pr-3 pl-1",
                  sel ? "bg-primary-tint shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-bg",
                )}
              >
                {handle}
                <button
                  type="button"
                  aria-current={sel ? "true" : undefined}
                  onClick={() => setSelectedId(c.id)}
                  className="focus-inset flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-md p-1 text-left"
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 text-xs text-ink-muted">{i + 1}</span>
                    <span className={cn("truncate text-[13px] leading-[18px] text-ink", sel ? "font-semibold" : "font-medium")}>
                      {c.question || "New card"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 pl-3.5">
                    <StatusChip status={c.status === "ai_draft" ? "ai-draft" : "approved"} className="!h-5 !text-[11px]" />
                    <span className="text-xs leading-4 text-ink-muted">{CARD_CATEGORY_LABEL[c.category]}</span>
                  </span>
                </button>
              </div>
            )}
          />
        </div>
        <div className="flex gap-2 border-t border-line p-3">
          <Button size="sm" onClick={addCard} disabled={adding}>+ Add card</Button>
          <Button size="sm" variant="secondary-teal" onClick={draftMore} disabled={drafting} aria-busy={drafting}>
            {drafting ? "Drafting…" : "Draft more with AI"}
          </Button>
        </div>
      </section>

      {selected ? (
        <section aria-labelledby="ed-h" className="flex min-w-0 flex-[1_1_400px] flex-col rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <h2 id="ed-h" className="m-0 text-sm leading-5 font-semibold text-ink">Card {index + 1}</h2>
            {isDraft ? <StatusChip status="ai-draft" /> : null}
            <span role="status" aria-live="polite" className="ml-auto text-xs text-ink-muted">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="mb-1.5 p-0 text-sm font-semibold text-ink">Category</legend>
              <CategoryRadios value={selected.category} onChange={(category) => edit({ category })} />
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-ink">Question</span>
              <Textarea
                ref={questionRef}
                rows={2}
                value={selected.question}
                onChange={(e) => edit({ question: e.target.value })}
                onBlur={() => flush(selected.id)}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">What a strong answer includes</span>
              <BulletListEditor
                tone="strong"
                label="What a strong answer includes"
                items={selected.strongAnswerPoints}
                onChange={(strongAnswerPoints) => edit({ strongAnswerPoints })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Common mistakes</span>
              <BulletListEditor
                tone="mistake"
                label="Common mistakes"
                items={selected.commonMistakes}
                onChange={(commonMistakes) => edit({ commonMistakes })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="card-tip" className="text-sm font-semibold text-ink">
                Tip <span className="font-normal text-ink-muted">(one line)</span>
              </label>
              <Input
                id="card-tip"
                value={selected.tip}
                maxLength={TIP_MAX_LENGTH}
                aria-describedby="card-tip-count"
                onChange={(e) => edit({ tip: e.target.value })}
                onBlur={() => flush(selected.id)}
              />
              <span id="card-tip-count" className="self-end text-xs text-ink-muted">
                {selected.tip.length} / {TIP_MAX_LENGTH}
              </span>
            </div>
          </div>
          {isDraft ? (
            <div className="mt-auto flex flex-wrap items-center gap-2 rounded-b-lg border-t border-line bg-improve-soft px-4 py-3">
              <span className="mr-auto max-w-[260px] text-xs leading-4 text-ai-text">
                AI draft from the role description. Candidates won’t see it until you approve it.
              </span>
              <button
                ref={discardRef}
                type="button"
                onClick={() => setDiscardOpen(true)}
                disabled={busy}
                className="h-9 cursor-pointer rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-error"
              >
                Discard
              </button>
              <Button variant="primary" onClick={approve} disabled={busy}>Approve card</Button>
            </div>
          ) : (
            <div className="mt-auto border-t border-line px-4 py-3 text-xs leading-4 text-ink-muted">
              Approved. Changes save automatically and show to candidates once the role is approved.
            </div>
          )}
        </section>
      ) : null}

      {selected ? (
        <section aria-labelledby="pv-h" className="flex max-w-full flex-[0_0_300px] flex-col gap-3">
          <h2 id="pv-h" className="m-0 text-sm leading-5 font-semibold text-ink">Candidate preview</h2>
          <div className="text-xs leading-4 text-ink-muted">Front</div>
          <FlashCardPreview
            side="front"
            category={CARD_CATEGORY_LABEL[selected.category]}
            question={selected.question || "Your question appears here"}
            strong={selected.strongAnswerPoints.filter(Boolean)}
            tip={selected.tip}
            mistakes={selected.commonMistakes.filter(Boolean)}
            index={index + 1}
            total={cards.length}
          />
          <div className="text-xs leading-4 text-ink-muted">Back</div>
          <FlashCardPreview
            side="back"
            category={CARD_CATEGORY_LABEL[selected.category]}
            question={selected.question || "Your question appears here"}
            strong={selected.strongAnswerPoints.filter(Boolean)}
            tip={selected.tip}
            mistakes={selected.commonMistakes.filter(Boolean)}
            index={index + 1}
            total={cards.length}
          />
        </section>
      ) : null}

      <ConfirmDialog
        open={discardOpen}
        title="Discard this AI draft?"
        body="The card is deleted and never shown to candidates. This can’t be undone, but you can draft more with AI later."
        confirmLabel="Discard card"
        tone="destructive"
        onConfirm={discard}
        onCancel={() => setDiscardOpen(false)}
        returnFocusRef={discardRef}
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
              "h-[30px] cursor-pointer rounded-full border px-3 text-[13px] font-medium",
              on ? "border-primary bg-primary-soft text-primary-text" : "border-line bg-surface text-ink",
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
    <div className="flex flex-wrap items-start gap-4" aria-busy="true" aria-label="Loading flash cards">
      <div className="h-[480px] max-w-full flex-[0_0_320px] animate-pulse rounded-lg border border-line bg-neutral-soft" />
      <div className="h-[480px] min-w-0 flex-[1_1_400px] animate-pulse rounded-lg border border-line bg-neutral-soft" />
      <div className="h-[480px] max-w-full flex-[0_0_300px] animate-pulse rounded-lg border border-line bg-neutral-soft" />
    </div>
  );
}
