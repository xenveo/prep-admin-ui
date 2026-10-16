"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, firstName } from "@/lib/format";
import {
  answerDimensionLabel,
  FLAG_DIMENSION_LABEL,
  FLAG_ISSUE_LABEL,
  type AnswerMode,
  type EvaluationFlag,
  type FlagDimension,
  type FlagIssue,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { resolveFlag, submitFlag } from "@/services/sessions";

const EYEBROW = "m-0 font-mono text-xs font-normal uppercase tracking-[0.08em] text-ink-faint";

const DIMENSIONS: FlagDimension[] = ["structure", "content", "delivery", "relevance", "overall", "feedback"];
const DIMENSION_OPTION: Record<FlagDimension, string> = {
  ...FLAG_DIMENSION_LABEL,
  overall: "Overall score",
  feedback: "Feedback text",
};
const ISSUES = Object.keys(FLAG_ISSUE_LABEL) as FlagIssue[];

/** How a question was answered: one mode for all its tries, or "mixed" when they differ. */
export type QuestionMode = AnswerMode | "mixed";

/** "Clarity (written)" for typed answers, "Delivery / clarity" when tries differ, else "Delivery". */
function deliveryLabel(mode: QuestionMode | undefined): string {
  return mode === "mixed" ? "Delivery / clarity" : answerDimensionLabel("delivery", mode ?? "voice");
}

/** Flag titles end in the dimension label ("Session 2 · Q4 · Delivery"); relabel delivery for typed answers. */
function flagTitle(f: EvaluationFlag, mode: QuestionMode | undefined): string {
  const suffix = ` · ${FLAG_DIMENSION_LABEL.delivery}`;
  if (f.dimension !== "delivery" || !f.title.endsWith(suffix)) return f.title;
  return `${f.title.slice(0, -suffix.length)} · ${deliveryLabel(mode)}`;
}

export function FlagRail({
  sessionId,
  questionNumber,
  candidateName,
  flags,
  flagsError,
  onSubmitted,
  questionModes,
}: {
  sessionId: string;
  questionNumber: number;
  candidateName: string;
  flags: EvaluationFlag[] | undefined;
  flagsError: boolean;
  onSubmitted: () => void;
  /** Answer mode per question number, for the delivery label. Questions without tries are omitted. */
  questionModes?: Partial<Record<number, QuestionMode>>;
}) {
  const dimensionOption: Record<FlagDimension, string> = {
    ...DIMENSION_OPTION,
    delivery: deliveryLabel(questionModes?.[questionNumber]),
  };
  const issueLabelId = useId();
  const issueGroupRef = useRef<HTMLDivElement>(null);
  const [dimension, setDimension] = useState<FlagDimension>("structure");
  const [issue, setIssue] = useState<FlagIssue | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState("");

  async function resolve(id: string) {
    if (!resolution[id]?.trim() || resolving) return;
    setResolving(id);
    setResolveError("");
    try {
      await resolveFlag(id, resolution[id]);
      onSubmitted();
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : "The flag could not be resolved.");
    } finally {
      setResolving(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!issue || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitFlag({ sessionId, questionNumber, dimension, issue, note });
      setNote("");
      setIssue(null);
      setMessage(`Flag added to history. Nothing changes for ${firstName(candidateName)} until it’s reviewed.`);
      onSubmitted();
    } catch {
      setError("The flag wasn’t saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Radio-group keys: arrows move and select, wrapping at the ends. */
  function onIssueKey(e: KeyboardEvent, index: number) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (index + d + ISSUES.length) % ISSUES.length;
    setIssue(ISSUES[next]);
    issueGroupRef.current?.querySelector<HTMLButtonElement>(`[data-issue="${ISSUES[next]}"]`)?.focus();
  }

  return (
    <aside aria-label="Flag this evaluation" className="flex min-w-0 flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 text-base font-semibold text-ink">Flag this evaluation</h2>
          <p className="m-0 text-[13px] leading-normal text-ink-faint">
            If the AI scored question {questionNumber} wrongly, tell us. The score stays as is until someone reviews it.
          </p>
        </div>
        <Field label="Dimension">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={dimension} onChange={(e) => setDimension(e.target.value as FlagDimension)}>
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {dimensionOption[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span id={issueLabelId} className="text-[13px] leading-5 font-semibold text-ink">
            What’s wrong
          </span>
          <div ref={issueGroupRef} role="radiogroup" aria-labelledby={issueLabelId} className="flex flex-wrap gap-1.5">
            {ISSUES.map((i, index) => {
              const on = issue === i;
              const focusable = on || (issue === null && index === 0);
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-issue={i}
                  tabIndex={focusable ? 0 : -1}
                  onClick={() => setIssue(i)}
                  onKeyDown={(e) => onIssueKey(e, index)}
                  className={cn(
                    "cursor-pointer rounded-full border px-[11px] py-1.5 text-xs font-semibold",
                    on
                      ? "border-primary-line bg-primary-tint text-primary-text"
                      : "border-input-line text-ink-muted hover:bg-row-hover hover:text-ink",
                  )}
                >
                  {FLAG_ISSUE_LABEL[i]}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Note" optional error={error || undefined}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="What should the score reflect?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <button
          type="submit"
          disabled={busy || !issue}
          className={cn(
            "w-full rounded-[10px] py-3 text-sm font-bold transition-[filter] duration-100",
            busy || !issue
              ? "cursor-not-allowed bg-neutral-soft text-ink-faint"
              : "cursor-pointer bg-primary text-on-primary hover:brightness-95",
          )}
        >
          {busy ? "Submitting…" : "Submit flag"}
        </button>
        <p role="status" className={cn("m-0 text-[13px] text-primary-text", !message && "sr-only")}>
          {message}
        </p>
      </form>

      <section aria-labelledby="flag-history" className="flex flex-col gap-2.5">
        {resolveError && (
          <p role="alert" className="m-0 text-sm text-improve-text">
            {resolveError}
          </p>
        )}
        <h2 id="flag-history" className={EYEBROW}>
          Flag history
        </h2>
        {flagsError ? (
          <p className="m-0 text-[13px] text-ink-faint">Flag history didn’t load. Reload the page to try again.</p>
        ) : flags === undefined ? (
          <div className="h-16 animate-pulse rounded-[10px] bg-neutral-soft" />
        ) : flags.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-faint">No flags on this session yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {flags.map((f) => {
              const detail = [f.issue ? FLAG_ISSUE_LABEL[f.issue] : "", f.note].filter(Boolean).join(" · ");
              return (
                <li key={f.id} className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{flagTitle(f, questionModes?.[f.questionNumber])}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold",
                        f.status === "open" ? "text-improve-text" : "text-primary-text",
                      )}
                    >
                      {f.status === "open" ? "Pending review" : "Resolved"}
                    </span>
                  </div>
                  {detail && <p className="m-0 text-[13px] leading-normal text-ink-muted">{detail}</p>}
                  {f.status === "open" && (
                    <div className="mt-1 flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-xs text-ink-muted">
                        Resolution
                        <Textarea
                          rows={2}
                          value={resolution[f.id] ?? ""}
                          onChange={(e) => setResolution((r) => ({ ...r, [f.id]: e.target.value }))}
                        />
                      </label>
                      <Button size="sm" disabled={Boolean(resolving) || !resolution[f.id]?.trim()} onClick={() => resolve(f.id)}>
                        {resolving === f.id ? "Resolving…" : "Resolve flag"}
                      </Button>
                    </div>
                  )}
                  {f.resolution && <span className="text-xs text-ink-muted">{f.resolution}</span>}
                  <span className="text-xs text-ink-faint">
                    {f.createdByName} · {formatDate(f.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
