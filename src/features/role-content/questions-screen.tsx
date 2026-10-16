"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { BulletListEditor } from "@/components/ui/bullet-list-editor";
import { DataTable, type Column, type SortState } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { BAND_LABEL } from "@/lib/bands";
import { cn } from "@/lib/cn";
import { emitRoleChanged } from "@/lib/role-events";
import { deleteQuestion, draftQuestionsWithAI, evaluateSampleAnswer, getRole, listFlashCards, listQuestions, saveQuestion } from "@/services/roles";
import {
  CARD_CATEGORY_LABEL,
  DEFAULT_DIMENSION_WEIGHTS,
  DIMENSION_IDS,
  DIMENSION_LABEL,
  type CardCategory,
  type Difficulty,
  type DimensionWeights,
  type ExpectedStructure,
  type Question,
  type FlashCard,
  type Rubric,
  type TestEvaluation,
} from "@/lib/types";

const CATEGORIES = Object.keys(CARD_CATEGORY_LABEL) as CardCategory[];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const NEW_ID = "__new__";

type Form = { cardId: string | null; text: string; category: CardCategory; difficulty: Difficulty; rubric: Rubric };
type TestState = { answer: string; running: boolean; result?: TestEvaluation; error?: string };

function emptyForm(): Form {
  return {
    cardId: null,
    text: "",
    category: "behavioural",
    difficulty: "medium",
    rubric: { keyPoints: [{ point: "", example: "" }], redFlags: [], expectedStructure: "star" },
  };
}
function formOf(q: Question): Form {
  return { cardId: q.cardId, text: q.text, category: q.category, difficulty: q.difficulty, rubric: q.rubric };
}

/** Three rising bars (6/9/12px), filled up to the difficulty level. */
const DIFFICULTY_BARS = ["h-1.5", "h-[9px]", "h-3"] as const;

function DifficultyGlyph({ difficulty }: { difficulty: Difficulty }) {
  const level = DIFFICULTY_LEVEL[difficulty];
  return (
    <span className="inline-flex items-center gap-2 text-[13px] leading-5 text-ink-soft">
      <span aria-hidden="true" className="inline-flex items-end gap-0.5">
        {DIFFICULTY_BARS.map((h, i) => (
          <span key={h} className={cn("w-1 rounded-[1px]", h, i < level ? "bg-primary" : "bg-line")} />
        ))}
      </span>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

/** "39 → 52"; a skipped or unscored second try shows as —. Mint when the second try improved. */
function AvgCell({ first, second }: { first: number | null; second: number | null }) {
  if (first == null) return <span className="font-mono text-[13px] leading-5 text-ink-faint">—</span>;
  const improved = second != null && second > first;
  return (
    <span
      className={cn(
        "font-mono text-[13px] leading-5 whitespace-nowrap",
        improved ? "text-primary-text" : second == null ? "text-ink-faint" : "text-ink-soft",
      )}
    >
      {first} → {second ?? "—"}
    </span>
  );
}

const COLUMNS: Column<Question>[] = [
  {
    id: "question",
    header: "Question",
    width: "minmax(280px, 3fr)",
    render: (q) => (
      <span className="min-w-0 text-sm leading-[1.45] font-medium text-ink">
        {q.text || "Untitled question"}
        {q.status === "ai_draft" ? (
          <span className="ml-2 inline-flex h-5 items-center rounded-full bg-improve-soft px-2 align-[1px] text-[11px] leading-none font-semibold whitespace-nowrap text-improve-text">
            AI draft
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "category",
    header: "Category",
    width: 120,
    render: (q) => <span className="text-[13px] leading-5 text-ink-soft">{CARD_CATEGORY_LABEL[q.category]}</span>,
  },
  { id: "difficulty", header: "Difficulty", width: 110, render: (q) => <DifficultyGlyph difficulty={q.difficulty} /> },
  {
    id: "asked",
    header: "Times asked",
    align: "right",
    width: 90,
    render: (q) => <span className="font-mono text-[13px] leading-5">{q.timesAsked}</span>,
  },
  {
    id: "avg",
    header: "Avg 1st → 2nd",
    headerTooltip: "Average score, first try to second try",
    align: "right",
    width: 110,
    sortable: true,
    render: (q) => <AvgCell first={q.avgFirstTry} second={q.avgSecondTry} />,
  },
  {
    id: "open",
    header: <span className="sr-only">Open</span>,
    align: "right",
    width: 16,
    render: () => (
      <span aria-hidden="true" className="text-ink-faint">
        <Icon name="chevron-right" size={14} />
      </span>
    ),
    skeletonWidth: 8,
  },
];

const SCORE_OK = 70;

export function QuestionsScreen({ roleId }: { roleId: string }) {
  const toast = useToast();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const draftAbort = useRef<AbortController | null>(null);
  const [perSession, setPerSession] = useState<number | null>(null);
  const [weights, setWeights] = useState<DimensionWeights>(DEFAULT_DIMENSION_WEIGHTS);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortState>({ columnId: "avg", direction: "asc" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Form>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const focusRow = useRef<((id: string) => void) | null>(null);
  const lastRowRef = useRef<string | null>(null);

  const fetchAll = useCallback(() => {
    Promise.all([listQuestions(roleId), getRole(roleId), listFlashCards(roleId)]).then(
      ([qs, role, cards]) => {
        setCards(cards);
        setQuestions(qs);
        setPerSession(role.settings.questionsPerSession);
        setWeights(role.settings.dimensionWeights);
      },
      () => setError(true),
    );
  }, [roleId]);

  const load = useCallback(() => {
    setError(false);
    setQuestions(null);
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
    return () => draftAbort.current?.abort();
  }, [fetchAll]);

  const rows = useMemo(() => {
    const list = (questions ?? []).slice();
    const dir = sort.direction === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (a.avgFirstTry == null && b.avgFirstTry == null) return 0;
      if (a.avgFirstTry == null) return 1;
      if (b.avgFirstTry == null) return -1;
      return (a.avgFirstTry - b.avgFirstTry) * dir;
    });
    return list;
  }, [questions, sort]);

  const isNew = openId === NEW_ID;
  const openQuestion = openId && !isNew ? questions?.find((q) => q.id === openId) : undefined;
  const panelOpen = isNew || Boolean(openQuestion);
  const form: Form | null = !panelOpen ? null : (drafts[openId!] ?? (openQuestion ? formOf(openQuestion) : emptyForm()));
  const test: TestState = (openId && tests[openId]) || { answer: "", running: false };
  const openIndex = openQuestion ? rows.findIndex((q) => q.id === openQuestion.id) : -1;

  function openRow(q: Question) {
    lastRowRef.current = q.id;
    setOpenId(q.id);
  }

  function close() {
    const id = lastRowRef.current;
    setOpenId(null);
    if (id) setTimeout(() => focusRow.current?.(id), 0);
  }

  /** Cancel throws away unsaved edits; closing with ✕ or Esc keeps them for next time. */
  function cancel() {
    const id = openId;
    if (id) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }
    close();
  }

  function setForm(patch: Partial<Form>) {
    if (!openId || !form) return;
    setDrafts((d) => ({ ...d, [openId]: { ...form, ...patch } }));
  }
  function setRubric(patch: Partial<Rubric>) {
    if (form) setForm({ rubric: { ...form.rubric, ...patch } });
  }
  function patchTest(patch: Partial<TestState>) {
    if (!openId) return;
    setTests((t) => ({ ...t, [openId]: { ...(t[openId] ?? { answer: "", running: false }), ...patch } }));
  }

  function cleanForm(f: Form): Form {
    return {
      ...f,
      rubric: {
        ...f.rubric,
        keyPoints: f.rubric.keyPoints.filter((k) => k.point.trim() !== ""),
        redFlags: f.rubric.redFlags.filter((r) => r.trim() !== ""),
      },
    };
  }

  async function save(approve = false) {
    if (!form || !openId) return;
    if (form.text.trim() === "") {
      toast.show({ title: "Add the question text first" });
      return;
    }
    setSaving(true);
    try {
      const c = cleanForm(form);
      const saved = await saveQuestion(roleId, {
        roleId,
        id: isNew ? undefined : openId,
        ...c,
        ...(approve ? { status: "approved" as const } : {}),
      });
      setQuestions((qs) => {
        const list = qs ?? [];
        return list.some((q) => q.id === saved.id) ? list.map((q) => (q.id === saved.id ? { ...saved } : q)) : [...list, saved];
      });
      setDrafts((d) => {
        const next = { ...d };
        delete next[openId];
        return next;
      });
      emitRoleChanged(roleId);
      toast.show({ title: approve ? "Question approved" : "Question saved" });
      if (isNew) {
        lastRowRef.current = saved.id;
        setOpenId(saved.id);
      }
    } catch (error) {
      toast.show({ title: "Couldn't save the question", detail: error instanceof Error ? error.message : "Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion() {
    if (!openQuestion || saving) return;
    setSaving(true);
    try {
      await deleteQuestion(openQuestion.id);
      setQuestions((qs)=>qs?.filter((q)=>q.id !== openQuestion.id) ?? []);
      setDeleting(false); close(); emitRoleChanged(roleId);
      toast.show({title:"Question removed",detail:"Past sessions and scores are kept."});
    } catch(error) {toast.show({title:"Couldn't remove question",detail:error instanceof Error ? error.message : "Try again."});}
    finally {setSaving(false);}
  }

  async function runTest() {
    if (!openQuestion) return;
    const id = openQuestion.id;
    const answer = test.answer;
    setTests((t) => ({ ...t, [id]: { answer, running: true } }));
    try {
      const result = await evaluateSampleAnswer(id, answer);
      setTests((t) => ({ ...t, [id]: { answer, running: false, result } }));
    } catch (e) {
      setTests((t) => ({
        ...t,
        [id]: { answer, running: false, error: e instanceof Error ? e.message : "The evaluation didn't run. Try again." },
      }));
    }
  }

  async function draftMore() {
    setDrafting(true);
    draftAbort.current?.abort();
    const controller = new AbortController();
    draftAbort.current = controller;
    try {
      const created = await draftQuestionsWithAI(roleId, controller.signal);
      setQuestions((qs) => [...(qs ?? []), ...created]);
      emitRoleChanged(roleId);
      toast.show({title: `${created.length} AI drafts added`, detail: "Review and approve them before candidates see them."});
    } catch (error) {
      if (!controller.signal.aborted) toast.show({title: "Couldn't draft questions", detail: error instanceof Error ? error.message : "Try again."});
    } finally { if (!controller.signal.aborted) setDrafting(false); }
  }

  if (error) {
    return (
      <EmptyState
        icon="alert"
        title="Couldn't load questions"
        description="Check your connection and try again."
        action={<Button variant="primary" onClick={load}>Try again</Button>}
      />
    );
  }

  const count = questions?.length ?? 0;
  const toolbarText =
    questions === null
      ? "Loading questions…"
      : `${count} ${count === 1 ? "question" : "questions"} in the bank · ${perSession ?? "–"} asked per session`;
  const toolbarButton = "h-[34px]! rounded-[9px]! px-3.5!";
  const testReady = !isNew && test.answer.trim() !== "";

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm leading-5 text-ink-muted">{toolbarText}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className={cn(toolbarButton, "border-neutral-line!")} onClick={() => setOpenId(NEW_ID)}>
              + Add question
            </Button>
            <Button
              size="sm"
              variant="secondary-teal"
              className={toolbarButton}
              onClick={draftMore}
              disabled={drafting}
              aria-busy={drafting}
            >
              {drafting ? "Drafting…" : "✦ Draft more with AI"}
            </Button>
          </div>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowId={(q) => q.id}
          ariaLabel="Questions"
          sort={sort}
          onSortChange={setSort}
          onOpenRow={openRow}
          activeRowId={openQuestion?.id ?? null}
          loading={questions === null}
          focusRowIdRef={focusRow}
          className="[&_[role=row]]:px-5"
          rowClassName={(q) => cn("min-h-14!", q.id === openQuestion?.id && "bg-row-hover")}
          emptyState={
            <EmptyState
              icon="file"
              title="No questions yet"
              description="Add the questions candidates answer in a mock interview, with a rubric for each. Or let AI draft a first set."
              action={<Button variant="primary" onClick={() => setOpenId(NEW_ID)}>+ Add question</Button>}
              helper="AI drafts are labelled and stay hidden from candidates until you approve them."
            />
          }
        />
        <p className="m-0 text-xs leading-4 text-ink-faint">Averages only count scored attempts. Skipped second tries show as —.</p>
      </div>

      <SidePanel
        open={panelOpen}
        onClose={close}
        titleId="qe-title"
        header={
          <h2 id="qe-title" className="m-0 truncate text-[17px] leading-6 font-semibold text-ink">
            {isNew ? "New question" : `Question ${openIndex + 1}`}
          </h2>
        }
        headerActions={
          openQuestion ? (
            <StatusChip status={openQuestion.status === "ai_draft" ? "ai-draft" : "approved"} appearance="pill" />
          ) : null
        }
        footer={
          <div className="flex items-center gap-2 py-0.5">
            {openQuestion ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleting(true)}
                className="cursor-pointer border-0 bg-transparent px-0 py-2 text-sm font-semibold text-ink-muted hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                {openQuestion.status === "ai_draft" ? "Discard draft" : "Remove question"}
              </button>
            ) : null}
            <span className="flex-1" />
            {openQuestion?.status === "ai_draft" ? (
              <Button variant="secondary-teal" onClick={() => save(true)} disabled={saving}>
                Approve question
              </Button>
            ) : null}
            <Button variant="outline" className="border-neutral-line!" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" className="px-[18px]!" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        {form ? (
          <div className="flex flex-col gap-[22px]">
            {openQuestion?.status === "ai_draft" ? (
              <p className="m-0 rounded-[10px] bg-improve-soft px-3.5 py-3 text-[13px] leading-5 text-ai-text">
                AI draft. Candidates won’t see this question until you approve it.
              </p>
            ) : null}
            <label className="flex flex-col gap-2">
              <span className="text-sm leading-5 font-semibold text-ink">Question</span>
              <Textarea
                rows={2}
                value={form.text}
                onChange={(e) => setForm({ text: e.target.value })}
                className="rounded-[9px]! text-[15px]!"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm leading-5 font-semibold text-ink">Linked flash card</span>
              <Select
                value={form.cardId ?? ""}
                onChange={(e) => setForm({ cardId: e.target.value || null })}
                className="[&_select]:h-10"
              >
                <option value="">No linked card</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.position}. {card.question}
                    {card.status === "ai_draft" ? " (AI draft)" : ""}
                  </option>
                ))}
              </Select>
              <span className="text-xs leading-4 text-ink-faint">
                Required to approve the role. Candidates study this card before being asked.
              </span>
            </label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm leading-5 font-semibold text-ink">Category</span>
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ category: e.target.value as CardCategory })}
                  className="[&_select]:h-10"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CARD_CATEGORY_LABEL[c]}</option>
                  ))}
                </Select>
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-5 font-semibold text-ink">Difficulty</span>
                <div className="[&_[role=radio]]:h-auto [&_[role=radio]]:flex-1 [&_[role=radio]]:py-2 [&>[role=radiogroup]]:flex [&>[role=radiogroup]]:w-full">
                  <SegmentedControl<Difficulty>
                    label="Difficulty"
                    value={form.difficulty}
                    onChange={(difficulty) => setForm({ difficulty })}
                    options={(["easy", "medium", "hard"] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
                  />
                </div>
              </div>
            </div>

            <section aria-labelledby="rb-h" className="flex flex-col gap-4 border-t border-line pt-5">
              <div className="flex flex-col gap-[3px]">
                <h3 id="rb-h" className="m-0 text-base leading-6 font-semibold text-ink">Rubric</h3>
                <span className="text-[13px] leading-5 text-ink-faint">What the AI looks for when scoring this question.</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-5 font-semibold text-primary-text">Key points</span>
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {form.rubric.keyPoints.map((k, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-[10px] border border-line bg-surface p-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-[9px] inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] leading-none font-bold text-primary-text"
                      >
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Input
                          aria-label={`Key point ${i + 1}`}
                          value={k.point}
                          placeholder="What should the answer include?"
                          onChange={(e) =>
                            setRubric({ keyPoints: form.rubric.keyPoints.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)) })
                          }
                        />
                        <Input
                          aria-label={`Example for key point ${i + 1}`}
                          value={k.example}
                          placeholder="Example phrase that shows this (optional)"
                          onChange={(e) =>
                            setRubric({ keyPoints: form.rubric.keyPoints.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)) })
                          }
                          className="h-[34px]! border-dashed! border-line! bg-transparent! text-[13px]! text-neutral-text! focus:border-primary-line!"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove key point ${i + 1}`}
                        onClick={() => setRubric({ keyPoints: form.rubric.keyPoints.filter((_, j) => j !== i) })}
                        className="mt-1 inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-transparent text-ink-faint hover:bg-row-hover hover:text-ink"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => setRubric({ keyPoints: [...form.rubric.keyPoints, { point: "", example: "" }] })}
                  className="cursor-pointer self-start border-0 bg-transparent px-0 py-0.5 text-[13px] leading-5 font-semibold text-primary-text hover:underline"
                >
                  + Add key point
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-5 font-semibold text-improve-text">Red flags</span>
                <BulletListEditor
                  tone="mistake"
                  label="Red flags"
                  items={form.rubric.redFlags}
                  onChange={(redFlags) => setRubric({ redFlags })}
                  addLabel="+ Add red flag"
                />
              </div>
              <div className="flex flex-col items-start gap-2">
                <span className="text-sm leading-5 font-semibold text-ink">Expected structure</span>
                <SegmentedControl<ExpectedStructure>
                  label="Expected structure"
                  value={form.rubric.expectedStructure}
                  onChange={(expectedStructure) => setRubric({ expectedStructure })}
                  options={[
                    { value: "star", label: "STAR" },
                    { value: "problem_solution", label: "Problem → solution" },
                    { value: "free", label: "Free" },
                  ]}
                />
              </div>
            </section>

            <section aria-labelledby="tq-h" className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-[18px]">
              <div className="flex flex-col gap-[3px]">
                <h3 id="tq-h" className="m-0 text-[15px] leading-[22px] font-semibold text-ink">Test this question</h3>
                <span className="text-[13px] leading-5 text-ink-faint">
                  Type a sample answer to check the rubric. Results aren’t saved to any candidate.
                </span>
              </div>
              <Textarea
                aria-label="Sample answer"
                rows={4}
                value={test.answer}
                placeholder="Write an answer the way a candidate might…"
                onChange={(e) => patchTest({ answer: e.target.value })}
                className="rounded-[9px]!"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant={testReady ? "secondary-teal" : "outline"}
                  className={cn("h-[34px]! rounded-[9px]! px-3.5!", !testReady && "text-ink-faint! opacity-100! hover:border-input-line!")}
                  onClick={runTest}
                  aria-busy={test.running}
                  disabled={test.running}
                  disabledReason={
                    isNew ? "Save the question first" : test.answer.trim() === "" ? "Type a sample answer first" : undefined
                  }
                >
                  {test.running ? "Evaluating…" : test.result ? "✦ Run AI evaluation again" : "✦ Run AI evaluation"}
                </Button>
                {test.result ? (
                  <span className="text-[13px] leading-5 text-ink-faint">
                    Sample score {test.result.score} · {BAND_LABEL[test.result.band]}
                  </span>
                ) : null}
              </div>
              <div role="status" aria-live="polite" className="flex flex-col gap-2.5 empty:-mt-2.5">
                {test.error ? <p className="m-0 text-[13px] leading-5 font-medium text-improve-text">{test.error}</p> : null}
                {test.result ? <TestResult ev={test.result} weights={weights} /> : null}
              </div>
            </section>
          </div>
        ) : null}
      </SidePanel>
      <ConfirmDialog
        open={deleting}
        title={openQuestion?.status === "ai_draft" ? "Discard this question draft?" : "Remove this question?"}
        body="Candidates will no longer be asked this question in new sessions. Past sessions and scores are kept."
        tone="destructive"
        confirmLabel={saving ? "Removing…" : "Remove question"}
        onCancel={() => setDeleting(false)}
        onConfirm={removeQuestion}
      />
    </>
  );
}

type ResultRow = { key: string; mark: string; tone: "good" | "warn"; label: string; text: string };

/** Sample-answer result: matched points (✓), issues (!), then each dimension's score. */
function TestResult({ ev, weights }: { ev: TestEvaluation; weights: DimensionWeights }) {
  const rows: ResultRow[] = [
    ...ev.matched.map((text, i): ResultRow => ({ key: `m${i}`, mark: "✓", tone: "good", label: "Matched:", text })),
    ...ev.issues.map((text, i): ResultRow => ({ key: `i${i}`, mark: "!", tone: "warn", label: "Issue:", text })),
    ...DIMENSION_IDS.map((id): ResultRow => ({
      key: id,
      mark: String(ev.subScores[id]),
      tone: ev.subScores[id] >= SCORE_OK ? "good" : "warn",
      label: "",
      text: `${DIMENSION_LABEL[id]} · ${weights[id]}% of the score`,
    })),
  ];
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-2.5">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-2.5 text-[13px] leading-normal">
            <span
              aria-hidden={r.label ? true : undefined}
              className={cn(
                "min-w-[22px] shrink-0 font-bold tabular-nums",
                r.tone === "good" ? "text-primary-text" : "text-improve-text",
              )}
            >
              {r.mark}
            </span>
            <span className="text-ink-soft">
              {r.label ? <span className="sr-only">{r.label} </span> : null}
              {r.text}
            </span>
          </li>
        ))}
      </ul>
      {ev.candidateFeedback ? (
        <p className="m-0 mt-1 rounded-lg bg-primary-tint px-2.5 py-2 text-[13px] leading-normal text-ink-soft">
          <span className="font-semibold text-primary-text">Candidate sees: </span>
          {ev.candidateFeedback}
        </p>
      ) : null}
    </div>
  );
}
