"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, firstName } from "@/lib/format";
import {
  FLAG_DIMENSION_LABEL,
  FLAG_ISSUE_LABEL,
  type EvaluationFlag,
  type FlagDimension,
  type FlagIssue,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { resolveFlag, submitFlag } from "@/services/sessions";

const DIMENSIONS: FlagDimension[] = ["structure", "content", "delivery", "relevance", "overall", "feedback"];
const DIMENSION_OPTION: Record<FlagDimension, string> = {
  ...FLAG_DIMENSION_LABEL,
  overall: "Overall score",
  feedback: "Feedback text",
};
const ISSUES = Object.keys(FLAG_ISSUE_LABEL) as FlagIssue[];

export function FlagRail({
  sessionId,
  questionNumber,
  candidateName,
  flags,
  flagsError,
  onSubmitted,
}: {
  sessionId: string;
  questionNumber: number;
  candidateName: string;
  flags: EvaluationFlag[] | undefined;
  flagsError: boolean;
  onSubmitted: () => void;
}) {
  const [dimension, setDimension] = useState<FlagDimension>("structure");
  const [issue, setIssue] = useState<FlagIssue>("too_low");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<Record<string,string>>({});
  const [resolving,setResolving] = useState<string | null>(null);
  const [resolveError,setResolveError] = useState("");
  async function resolve(id:string) {
    if (!resolution[id]?.trim() || resolving) return;
    setResolving(id); setResolveError("");
    try { await resolveFlag(id,resolution[id]); onSubmitted(); }
    catch(error) {setResolveError(error instanceof Error ? error.message : "The flag could not be resolved.");}
    finally {setResolving(null);}
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitFlag({ sessionId, questionNumber, dimension, issue, note });
      setNote("");
      setMessage(`Flag added to history. Nothing changes for ${firstName(candidateName)} until it’s reviewed.`);
      onSubmitted();
    } catch {
      setError("The flag wasn’t saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Flag this evaluation" className="flex min-w-0 flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
        <div>
          <h2 className="m-0 text-base font-semibold text-ink">Flag this evaluation</h2>
          <p className="m-0 mt-1 text-xs leading-4 text-ink-muted">
            If the AI scored question {questionNumber} wrongly, tell us. The score stays as is until someone reviews it.
          </p>
        </div>
        <Field label="Dimension">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={dimension} onChange={(e) => setDimension(e.target.value as FlagDimension)}>
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {DIMENSION_OPTION[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ink">What’s wrong</legend>
          {ISSUES.map((i) => (
            <label key={i} className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="flag-issue"
                value={i}
                checked={issue === i}
                onChange={() => setIssue(i)}
                className="size-4 accent-[var(--primary)]"
              />
              {FLAG_ISSUE_LABEL[i]}
            </label>
          ))}
        </fieldset>
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
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit flag"}
        </Button>
        <p role="status" className={cn("m-0 text-[13px] text-primary-text", !message && "sr-only")}>
          {message}
        </p>
      </form>

      <section aria-labelledby="flag-history" className="flex flex-col gap-2">
        {resolveError && <p role="alert" className="text-sm text-improve-text">{resolveError}</p>}
        <h2 id="flag-history" className="m-0 text-base font-semibold text-ink">
          Flag history
        </h2>
        {flagsError ? (
          <p className="m-0 text-[13px] text-ink-muted">Flag history didn’t load. Reload the page to try again.</p>
        ) : flags === undefined ? (
          <div className="h-16 animate-pulse rounded-md bg-neutral-soft" />
        ) : flags.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">No flags on this session yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {flags.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{f.title}</span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      f.status === "open" ? "bg-ai-soft text-ai-text" : "bg-primary-soft text-primary-text",
                    )}
                  >
                    {f.status === "open" ? "Open" : "Resolved"}
                  </span>
                </div>
                {f.issue && <span className="text-xs text-ink-muted">{FLAG_ISSUE_LABEL[f.issue]}</span>}
                {f.note && <span className="text-[13px] leading-5 text-ink">{f.note}</span>}
                {f.status === "open" && <div className="flex flex-col gap-2"><label className="text-xs text-ink-muted">Resolution<Textarea rows={2} value={resolution[f.id] ?? ""} onChange={(e)=>setResolution((r)=>({...r,[f.id]:e.target.value}))} /></label><Button size="sm" disabled={Boolean(resolving) || !resolution[f.id]?.trim()} onClick={()=>resolve(f.id)}>{resolving === f.id ? "Resolving…" : "Resolve flag"}</Button></div>}
                {f.resolution && <span className="text-xs text-ink-muted">{f.resolution}</span>}
                <span className="text-xs text-ink-muted">
                  {f.createdByName} · {formatDate(f.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
