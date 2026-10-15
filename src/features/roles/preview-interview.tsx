"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, resolveApiUrl } from "@/lib/api/client";
import {
  PREVIEW_CONSENT, abandonPreview, completePreview, getPreview, isPreviewInProgress,
  previewPollDelay, skipPreviewRetry, startPreview, submitPreviewAnswer,
  type PreviewAttempt, type PreviewSession,
} from "@/services/preview";
import { useRole } from "./role-context";

type Submission = { questionId: string; attemptNo: 1 | 2; text: string; key: string };
const message = (error: unknown) => error instanceof Error ? error.message : "The request failed. Try again.";

function Feedback({ attempt }: { attempt: PreviewAttempt }) {
  return <section className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
    <h4 className="text-sm font-semibold">Try {attempt.attemptNo} · {attempt.feedback.score}/100</h4>
    <p className="whitespace-pre-wrap text-sm text-ink-muted">{attempt.transcript}</p>
    <p className="text-sm">{attempt.feedback.opener}</p>
    {attempt.feedback.worked.length > 0 && <div><h5 className="text-sm font-semibold">What worked</h5><ul className="list-disc pl-5 text-sm">{attempt.feedback.worked.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {attempt.feedback.improve.length > 0 && <div><h5 className="text-sm font-semibold">Improve next time</h5><ul className="list-disc pl-5 text-sm">{attempt.feedback.improve.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {attempt.feedbackAudioUrl && <audio aria-label={`Try ${attempt.attemptNo} spoken feedback`} controls preload="none" src={resolveApiUrl(attempt.feedbackAudioUrl)} />}
  </section>;
}

/** Admin route for FR-ROLE-07; all progress and scoring come from owned API sessions. */
export function PreviewInterview() {
  const role = useRole();
  const router = useRouter();
  const search = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(search.get("session"));
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [consent, setConsent] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [uncertain, setUncertain] = useState<Submission | null>(null);
  const mutationLock = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const base = `/roles/${encodeURIComponent(role.id)}`;

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    async function load() {
      try {
        for (let poll = 0; poll < 90; poll++) {
          const fresh = await getPreview(sessionId!, controller.signal);
          if (controller.signal.aborted) return;
          setSession(fresh);
          setLoading(false);
          setUncertain((previous) => {
            if (!previous) return null;
            if (isPreviewInProgress(fresh) && fresh.failed?.questionId === previous.questionId && fresh.failed.attemptNo === previous.attemptNo) return null;
            const result = fresh.results.find((row) => row.question.id === previous.questionId);
            return result && (previous.attemptNo === 1 || result.second || result.state === "done") ? null : previous;
          });
          if (!isPreviewInProgress(fresh) || !fresh.pending) return;
          await previewPollDelay(controller.signal);
        }
        setError("Evaluation is still running. Check session status in a moment; your answer is already submitted.");
      } catch (failure) {
        if (!controller.signal.aborted) { setError(message(failure)); setLoading(false); }
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId, tick]);

  function keepSession(id: string | null) {
    setSessionId(id);
    router.replace(id ? `${base}/test?session=${encodeURIComponent(id)}` : `${base}/test`, { scroll: false });
  }

  async function mutate(action: (signal: AbortSignal) => Promise<void>) {
    if (mutationLock.current || !lifecycle.current) return;
    const signal = lifecycle.current.signal;
    mutationLock.current = true;
    setBusy(true);
    setError(null);
    try { await action(signal); }
    catch (failure) {
      if (!signal.aborted) {
        setError(message(failure));
        // A lost completion/skip/attempt response may still have committed on the server.
        if (sessionId) setTick((value) => value + 1);
      }
    } finally {
      mutationLock.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  const active = session && isPreviewInProgress(session) ? session : null;
  const question = active?.questions.find((item) => item.index === active.currentQuestion);
  const result = question ? active?.results.find((item) => item.question.id === question.id) : undefined;
  const attemptNo: 1 | 2 = result ? 2 : 1;
  const blocked = busy || loading || Boolean(active?.pending) || Boolean(uncertain);

  function submit(previous?: Submission) {
    if (!sessionId || (!question && !previous)) return;
    const submission = previous ?? { questionId: question!.id, attemptNo, text: text.trim(), key: crypto.randomUUID() };
    void mutate(async (signal) => {
      setUncertain(submission);
      try {
        await submitPreviewAnswer(sessionId, submission.questionId, submission.attemptNo, submission.text, submission.key, signal);
      } catch (failure) {
        // A definite validation/access rejection leaves the draft editable. Network/5xx
        // failures retain the exact payload/key because the write may have committed.
        if (!signal.aborted && failure instanceof ApiError && failure.status >= 400 && failure.status < 500 && failure.status !== 409) setUncertain(null);
        throw failure;
      }
      if (signal.aborted) return;
      setUncertain(null);
      setText("");
      setLoading(true);
      setTick((value) => value + 1);
    });
  }

  return <div className="flex max-w-3xl flex-col gap-5 text-ink">
    <div className="flex flex-col items-start gap-2">
      <h2 className="text-base font-semibold">Test interview</h2>
      <p className="text-sm text-ink-muted">Practise the approved questions with real AI feedback. Test sessions are excluded from candidate reports and statistics. This runner accepts typed answers.</p>
      <ButtonLink href={`${base}/preview`} size="sm">Back to content preview</ButtonLink>
    </div>
    {error && <div role="alert" className="flex flex-col items-start gap-2 text-sm text-error"><p>{error}</p>{sessionId && <Button disabled={busy} onClick={() => { setError(null); setLoading(true); setTick((value) => value + 1); }}>Check session status</Button>}</div>}
    {!sessionId && <div className="flex flex-col items-start gap-4">
      <div className="flex items-start gap-3"><Checkbox checked={consent} onChange={setConsent} label={PREVIEW_CONSENT} disabled={busy} /><p className="text-sm">{PREVIEW_CONSENT}</p></div>
      <Button variant="primary" disabled={busy || !consent || role.status === "archived"} onClick={() => void mutate(async (signal) => {
        const started = await startPreview(role.id, signal);
        if (signal.aborted) return;
        setSession(null); setLoading(true); keepSession(started.id);
      })}>{busy ? "Starting…" : "Start or resume test interview"}</Button>
    </div>}
    {sessionId && loading && <p role="status" className="text-sm text-ink-muted">Checking session…</p>}
    {sessionId && !loading && !session && <Button onClick={() => { keepSession(null); setError(null); }}>Return to test setup</Button>}
    {active && <>
      {active.pending && <p role="status" className="text-sm">Evaluating try {active.pending.attemptNo}… You can return to this URL to resume.</p>}
      {active.failed && <p role="alert" className="text-sm text-error">Evaluation failed ({active.failed.code}). Submit the answer again to retry processing, or abandon this test.</p>}
      {uncertain && !active.pending && <div className="flex flex-col items-start gap-2"><p className="text-sm">The submission outcome is uncertain. Check the server status or resend the same answer safely.</p><Button disabled={busy} onClick={() => submit(uncertain)}>Resend same answer</Button></div>}
      {question ? <section className="flex flex-col gap-4">
        <h3 className="text-base font-semibold">Question {question.index} of {active.questions.length} · Try {attemptNo}</h3>
        <p className="text-sm">{question.text}</p>
        {result && <Feedback attempt={result.first} />}
        <Field label={result ? "Your improved answer" : "Your answer"} helper={`${text.length}/1500 characters`}>
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={text} maxLength={1500} disabled={blocked} rows={6} onChange={(event) => setText(event.target.value)} />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={blocked || !text.trim()} onClick={() => submit()}>Submit try {attemptNo}</Button>
          {result && !active.failed && <Button disabled={blocked} onClick={() => void mutate(async (signal) => { await skipPreviewRetry(sessionId!, question.id, signal); if (!signal.aborted) { setText(""); setLoading(true); setTick((value) => value + 1); } })}>Skip retry</Button>}
        </div>
      </section> : <Button variant="primary" disabled={blocked || Boolean(active.failed)} onClick={() => void mutate(async (signal) => {
        const report = await completePreview(sessionId!, signal);
        if (!signal.aborted) setSession(report);
      })}>{busy ? "Completing…" : "Complete test and view results"}</Button>}
      <Button disabled={busy || loading} onClick={() => void mutate(async (signal) => { await abandonPreview(sessionId!, signal); if (!signal.aborted) { keepSession(null); setSession(null); setUncertain(null); setText(""); } })}>Abandon test interview</Button>
    </>}
    {session && !isPreviewInProgress(session) && <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Test complete · {session.score}/100</h3>
      <p className="text-sm">{session.bandMessage}</p>
      {session.strengths.length > 0 && <div><h4 className="text-sm font-semibold">Strengths</h4><ul className="list-disc pl-5 text-sm">{session.strengths.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.focus.length > 0 && <div><h4 className="text-sm font-semibold">Focus areas</h4><ul className="list-disc pl-5 text-sm">{session.focus.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.results.map((row) => <div key={row.question.id} className="flex flex-col gap-3"><h4 className="text-sm font-semibold">{row.question.index}. {row.question.text}</h4><Feedback attempt={row.first} />{row.second ? <Feedback attempt={row.second} /> : <p className="text-sm text-ink-muted">Retry skipped.</p>}</div>)}
      <Button onClick={() => { keepSession(null); setSession(null); setError(null); }}>Start another test</Button>
    </section>}
  </div>;
}
