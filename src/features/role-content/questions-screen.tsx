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
import { BandChip } from "@/components/ui/band-chip";
import { SubScoreBars } from "@/components/charts/sub-score-bars";
import { HighlightLegend, TranscriptHighlights, type Highlight } from "@/components/media/transcript-highlights";
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

function DifficultyGlyph({ difficulty }: { difficulty: Difficulty }) {
  const level = DIFFICULTY_LEVEL[difficulty];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-3 w-1 rounded-[1px]", n <= level ? "bg-ink-soft" : "bg-line")} />
        ))}
      </span>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

const MISSING = <span className="text-ink-muted">–</span>;

const COLUMNS: Column<Question>[] = [
  {
    id: "question",
    header: "Question",
    width: "minmax(320px, 1fr)",
    render: (q) => <span className="block truncate">{q.text}</span>,
  },
  { id: "category", header: "Category", width: 140, render: (q) => CARD_CATEGORY_LABEL[q.category] },
  { id: "difficulty", header: "Difficulty", width: 108, render: (q) => <DifficultyGlyph difficulty={q.difficulty} /> },
  {
    id: "status",
    header: "Status",
    width: 112,
    render: (q) => <StatusChip status={q.status === "ai_draft" ? "ai-draft" : "approved"} />,
  },
  {
    id: "asked",
    header: "Times asked",
    align: "right",
    width: 112,
    render: (q) => (q.timesAsked > 0 ? q.timesAsked : MISSING),
  },
  {
    id: "avg",
    header: "Avg first → second",
    headerTooltip: "Average score, first try to second try",
    align: "right",
    width: 176,
    sortable: true,
    render: (q) =>
      q.avgFirstTry == null || q.avgSecondTry == null ? (
        MISSING
      ) : (
        <span className="whitespace-nowrap">
          {q.avgFirstTry}
          <span className="text-ink-muted"> → </span>
          <span className="font-semibold">{q.avgSecondTry}</span>
        </span>
      ),
  },
];

/** Only highlight evaluator evidence that occurs verbatim in the answer. */
function highlightsFor(ev: TestEvaluation): Highlight[] {
  return ev.matched.filter((text) => ev.answer.includes(text)).map((text) => ({text, kind: "match", note: "Matches a rubric key point"}));
}

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
    questions === null ? "Loading questions…" : `${count} ${count === 1 ? "question" : "questions"} · ${perSession ?? "–"} asked per session · showing ${rows.length}`;

  return (
    <>
      <section className="rounded-lg border border-line bg-surface">
        <div className="flex h-[52px] items-center justify-between gap-2 border-b border-line pr-3 pl-4">
          <span className="text-xs leading-4 text-ink-muted">{toolbarText}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setOpenId(NEW_ID)}>+ Add question</Button>
            <Button size="sm" variant="secondary-teal" onClick={draftMore} disabled={drafting} aria-busy={drafting}>
              {drafting ? "Drafting…" : "Draft more with AI"}
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
      </section>
      <p className="mt-4 mb-0 text-xs leading-4 text-ink-muted">↑ ↓ to move, Enter to open, Esc to close the editor.</p>

      <SidePanel
        open={panelOpen}
        onClose={close}
        titleId="qe-title"
        header={
          <div className="flex items-center gap-2">
            <h2 id="qe-title" className="m-0 text-base leading-6 font-semibold text-ink">
              {isNew ? "New question" : `Question ${openIndex + 1}`}
            </h2>
            {openQuestion ? <StatusChip status={openQuestion.status === "ai_draft" ? "ai-draft" : "approved"} /> : null}
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 px-6 py-3">
            {openQuestion?.status === "ai_draft" ? (
              <Button variant="secondary-teal" onClick={() => save(true)} disabled={saving} className="mr-auto">
                Approve question
              </Button>
            ) : null}
            {openQuestion && <Button disabled={saving} onClick={()=>setDeleting(true)}>{openQuestion.status === "ai_draft" ? "Discard draft" : "Remove question"}</Button>}
            <Button onClick={close}>Close</Button>
            <Button variant="primary" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        {form ? (
          <div className="flex flex-col gap-6 text-sm">
            {openQuestion?.status === "ai_draft" ? (
              <p className="m-0 rounded-md bg-improve-soft p-3 text-xs leading-4 text-ai-text">
                AI draft. Candidates won’t see this question until you approve it.
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-ink">Question</span>
                <Textarea rows={2} value={form.text} onChange={(e) => setForm({ text: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-ink">Linked flash card</span>
                <Select value={form.cardId ?? ""} onChange={(e) => setForm({cardId: e.target.value || null})}>
                  <option value="">No linked card</option>
                  {cards.map((card) => <option key={card.id} value={card.id}>{card.position}. {card.question}{card.status === "ai_draft" ? " (AI draft)" : ""}</option>)}
                </Select>
                <span className="text-xs text-ink-muted">Role approval requires questions linked to approved flash cards.</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Category</span>
                  <Select value={form.category} onChange={(e) => setForm({ category: e.target.value as CardCategory })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CARD_CATEGORY_LABEL[c]}</option>
                    ))}
                  </Select>
                </label>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Difficulty</span>
                  <SegmentedControl<Difficulty>
                    label="Difficulty"
                    value={form.difficulty}
                    onChange={(difficulty) => setForm({ difficulty })}
                    options={(["easy", "medium", "hard"] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
                  />
                </div>
              </div>
            </div>

            <section aria-labelledby="rb-h" className="flex flex-col gap-3">
              <h3 id="rb-h" className="m-0 text-base leading-6 font-semibold text-ink">Rubric</h3>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-ink">Key points</span>
                <ol className="m-0 list-none rounded-md border border-line p-0">
                  {form.rubric.keyPoints.map((k, i) => (
                    <li key={i} className={cn("flex items-start gap-2 px-3 py-2.5", i > 0 && "border-t border-line")}>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Input
                          aria-label={`Key point ${i + 1}`}
                          value={k.point}
                          placeholder="What a strong answer includes"
                          onChange={(e) =>
                            setRubric({ keyPoints: form.rubric.keyPoints.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)) })
                          }
                          className="h-8 text-[13px] font-medium"
                        />
                        <Input
                          aria-label={`Example for key point ${i + 1}`}
                          value={k.example}
                          placeholder="Example"
                          onChange={(e) =>
                            setRubric({ keyPoints: form.rubric.keyPoints.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)) })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove key point ${i + 1}`}
                        onClick={() => setRubric({ keyPoints: form.rubric.keyPoints.filter((_, j) => j !== i) })}
                        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => setRubric({ keyPoints: [...form.rubric.keyPoints, { point: "", example: "" }] })}
                  className="h-7 cursor-pointer self-start px-1.5 text-[13px] font-semibold text-primary-text"
                >
                  + Add key point
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-ink">Red flags</span>
                <BulletListEditor
                  tone="mistake"
                  label="Red flags"
                  items={form.rubric.redFlags}
                  onChange={(redFlags) => setRubric({ redFlags })}
                  addLabel="+ Add red flag"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-ink">Expected structure</span>
                <SegmentedControl<ExpectedStructure>
                  label="Expected structure"
                  value={form.rubric.expectedStructure}
                  onChange={(expectedStructure) => setRubric({ expectedStructure })}
                  options={[
                    { value: "star", label: "STAR" },
                    { value: "problem_solution", label: "Problem-solution" },
                    { value: "free", label: "Free" },
                  ]}
                />
              </div>
            </section>

            <section aria-labelledby="tq-h" className="flex flex-col gap-3 border-t border-line pt-5">
              <div className="flex flex-col">
                <h3 id="tq-h" className="m-0 text-base leading-6 font-semibold text-ink">Test this question</h3>
                <span className="text-xs leading-4 text-ink-muted">
                  Type a sample answer to check the rubric. Test results aren’t saved to any candidate.
                </span>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-ink">Sample answer</span>
                <Textarea
                  rows={5}
                  value={test.answer}
                  onChange={(e) => patchTest({ answer: e.target.value })}
                  className="text-[13px] leading-5"
                />
              </label>
              <Button
                variant="secondary-teal"
                className="self-start"
                onClick={runTest}
                aria-busy={test.running}
                disabled={test.running}
                disabledReason={
                  isNew ? "Save the question first" : test.answer.trim() === "" ? "Type a sample answer first" : undefined
                }
              >
                {test.running ? "Evaluating…" : "Run AI evaluation"}
              </Button>
              <div role="status" aria-live="polite">
                {test.error ? <p className="m-0 text-xs font-medium text-improve-text">{test.error}</p> : null}
                {test.result ? <TestResult ev={test.result} weights={weights} /> : null}
              </div>
            </section>
          </div>
        ) : null}
      </SidePanel>
      <ConfirmDialog open={deleting} title={openQuestion?.status === "ai_draft" ? "Discard this question draft?" : "Remove this question?"} body="Candidates will no longer be asked this question in new sessions. Past sessions and scores are kept." tone="destructive" confirmLabel={saving ? "Removing…" : "Remove question"} onCancel={()=>setDeleting(false)} onConfirm={removeQuestion} />
    </>
  );
}

function TestResult({ ev, weights }: { ev: TestEvaluation; weights: DimensionWeights }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-xl leading-7 font-bold text-ink">{ev.score}</span>
        <BandChip band={ev.band} />
        <span className="ml-auto inline-flex h-[22px] items-center rounded-full border border-dashed border-improve bg-improve-soft px-2 text-xs font-semibold text-ai-text">
          Test result
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <SubScoreBars
          scores={DIMENSION_IDS.map((id) => ({
            label: DIMENSION_LABEL[id],
            value: ev.subScores[id],
            weight: weights[id],
          }))}
        />
        <p className="m-0 text-xs text-ink-muted">
          Weights: {DIMENSION_IDS.map((id) => `${DIMENSION_LABEL[id]} ${weights[id]}%`).join(", ")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">Evidence</span>
        <TranscriptHighlights transcript={`“${ev.answer}”`} highlights={highlightsFor(ev)} />
        <HighlightLegend />
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs leading-4">
          {ev.matched.length > 0 ? (
            <li className="flex gap-1.5 text-primary-text">
              <span aria-hidden="true">✓</span>
              <span><span className="font-semibold">Matched:</span> {ev.matched.join(", ")}</span>
            </li>
          ) : null}
          {ev.issues.map((issue) => (
            <li key={issue} className="flex gap-1.5 text-improve-text">
              <span aria-hidden="true">!</span>
              <span><span className="font-semibold">Issue:</span> {issue}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5 rounded-md bg-primary-tint p-3">
        <span className="text-xs leading-4 font-semibold text-primary-text">Candidate sees this feedback</span>
        <p className="m-0 text-[13px] leading-5 text-ink">{ev.candidateFeedback}</p>
      </div>
    </div>
  );
}
