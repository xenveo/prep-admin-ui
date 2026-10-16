"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer } from "@/components/media/audio-waveform";
import { ApiError, resolveApiUrl } from "@/lib/api/client";
import {
  PREVIEW_CONSENT, abandonPreview, completePreview, getPreview, isPreviewInProgress,
  previewPollDelay, skipPreviewRetry, startPreview, submitPreviewAnswer, submitPreviewVoiceAnswer,
  type PreviewAttempt, type PreviewSession,
} from "@/services/preview";
import { useRole } from "./role-context";
import { MAX_RECORDING_SEC, useVoiceRecorder, useVoiceSupported } from "./use-voice-recorder";

type AnswerMode = "voice" | "typed";
type Answer = { mode: "typed"; text: string } | { mode: "voice"; audio: Blob; durationSec: number };
type Submission = { questionId: string; attemptNo: 1 | 2; key: string; answer: Answer };
const message = (error: unknown) => error instanceof Error ? error.message : "The request failed. Try again.";
const mmss = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
/** Spoken feedback is generated ~10 s after the written feedback; stop waiting after a minute. */
const AUDIO_WAIT_MS = 60_000;
const MIC_UNAVAILABLE = "Microphone not available. You can type your answer instead.";
const MODE_OPTIONS: { value: AnswerMode; label: string }[] = [{ value: "voice", label: "Voice" }, { value: "typed", label: "Typed" }];

type FeedbackAudio = { waiting: boolean; onCheckAgain: () => void };
function Feedback({ attempt, audio }: { attempt: PreviewAttempt; audio?: FeedbackAudio }) {
  const voice = attempt.mode === "voice";
  return <section className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
    <h4 className="text-sm font-semibold">Try {attempt.attemptNo}{voice ? " · Voice" : ""} · {attempt.feedback.score}/100</h4>
    {voice && <div className="flex flex-col gap-1"><h5 className="text-sm font-semibold">Your recording</h5><AudioPlayer label={`Try ${attempt.attemptNo} answer`} durationSeconds={attempt.durationSec ?? 1} src={attempt.audioUrl ? resolveApiUrl(attempt.audioUrl) : null} /></div>}
    <p className="whitespace-pre-wrap text-sm text-ink-muted">{attempt.transcript}</p>
    <p className="text-sm">{attempt.feedback.opener}</p>
    {attempt.feedback.worked.length > 0 && <div><h5 className="text-sm font-semibold">What worked</h5><ul className="list-disc pl-5 text-sm">{attempt.feedback.worked.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {attempt.feedback.improve.length > 0 && <div><h5 className="text-sm font-semibold">Improve next time</h5><ul className="list-disc pl-5 text-sm">{attempt.feedback.improve.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {attempt.feedbackAudioUrl ? <audio aria-label={`Try ${attempt.attemptNo} spoken feedback`} controls preload="none" src={resolveApiUrl(attempt.feedbackAudioUrl)} />
      : voice && audio && (audio.waiting
        ? <p role="status" className="text-sm text-ink-muted">Preparing audio…</p>
        : <div className="flex flex-wrap items-center gap-2"><p className="text-sm text-ink-muted">Spoken feedback isn&apos;t ready yet.</p><Button size="sm" onClick={audio.onCheckAgain}>Check again</Button></div>)}
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
  const recorder = useVoiceRecorder();
  const voiceSupported = useVoiceSupported();
  const [modeChoice, setModeChoice] = useState<AnswerMode>("voice");
  const voiceKeys = useRef(new WeakMap<Blob, { target: string; key: string }>());
  const recordButton = useRef<HTMLButtonElement>(null);
  const voiceSubmitButton = useRef<HTMLButtonElement>(null);
  const voicePanel = useRef<HTMLDivElement>(null);
  const audioWaitStarted = useRef(new Map<string, number>());
  const [audioTimedOut, setAudioTimedOut] = useState<ReadonlySet<string>>(() => new Set());
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
  const recorderStatus = recorder.state.status;
  const micUnavailable = recorderStatus === "denied" || recorderStatus === "unsupported";
  const answerMode: AnswerMode = voiceSupported && modeChoice === "voice" && !micUnavailable ? "voice" : "typed";
  const recording = recorderStatus === "recording";

  // Voice attempts get spoken feedback after evaluation; refetch until the URL appears (capped per attempt).
  const awaitingAudioKey = (session?.results ?? [])
    .flatMap((row) => [row.first, row.second])
    .filter((attempt): attempt is PreviewAttempt => Boolean(attempt && attempt.mode === "voice" && !attempt.feedbackAudioUrl && !audioTimedOut.has(attempt.id)))
    .map((attempt) => attempt.id).join(",");
  const audioPollPaused = loading || busy || Boolean(active?.pending);
  useEffect(() => {
    if (!sessionId || !awaitingAudioKey || audioPollPaused) return;
    const controller = new AbortController();
    const ids = awaitingAudioKey.split(",");
    const started = audioWaitStarted.current;
    const now = Date.now();
    for (const attemptId of ids) if (!started.has(attemptId)) started.set(attemptId, now);
    async function poll() {
      try {
        for (;;) {
          await previewPollDelay(controller.signal);
          const expired = ids.filter((attemptId) => Date.now() - (started.get(attemptId) ?? 0) >= AUDIO_WAIT_MS);
          if (expired.length) { setAudioTimedOut((previous) => new Set([...previous, ...expired])); return; }
          const fresh = await getPreview(sessionId!, controller.signal);
          if (controller.signal.aborted) return;
          setSession(fresh);
        }
      } catch {
        if (!controller.signal.aborted) setAudioTimedOut((previous) => new Set([...previous, ...ids]));
      }
    }
    void poll();
    return () => controller.abort();
  }, [sessionId, awaitingAudioKey, audioPollPaused]);

  function checkAudioAgain(attemptId: string) {
    audioWaitStarted.current.delete(attemptId);
    setAudioTimedOut((previous) => { const next = new Set(previous); next.delete(attemptId); return next; });
  }
  const feedbackAudio = (attempt: PreviewAttempt): FeedbackAudio => ({ waiting: !audioTimedOut.has(attempt.id), onCheckAgain: () => checkAudioAgain(attempt.id) });

  // Keep keyboard focus on the control that replaces the one just used (Record → Stop → Submit).
  useEffect(() => {
    const panel = voicePanel.current;
    const focused = document.activeElement;
    if (!panel || (focused && focused !== document.body && !panel.contains(focused))) return;
    if (recorderStatus === "recording") recordButton.current?.focus();
    else if (recorderStatus === "stopped") voiceSubmitButton.current?.focus();
  }, [recorderStatus]);

  function chooseMode(mode: AnswerMode) {
    if (mode === "voice" && micUnavailable) recorder.reset();
    if (mode === "typed" && (recording || recorderStatus === "requesting")) recorder.reset();
    setModeChoice(mode);
  }
  /** One key per recording and try, so resubmitting the same recording after an error is a safe replay. */
  function voiceKey(blob: Blob, questionId: string, tryNo: 1 | 2) {
    const target = `${questionId}:${tryNo}`;
    const known = voiceKeys.current.get(blob);
    if (known?.target === target) return known.key;
    const key = crypto.randomUUID();
    voiceKeys.current.set(blob, { target, key });
    return key;
  }
  function clearDrafts() {
    setText("");
    recorder.reset();
  }

  function submit(previous?: Submission) {
    if (!sessionId || (!question && !previous)) return;
    let submission = previous;
    if (!submission && answerMode === "voice") {
      if (recorder.state.status !== "stopped") return;
      const { blob, durationSec } = recorder.state.recording;
      submission = { questionId: question!.id, attemptNo, key: voiceKey(blob, question!.id, attemptNo), answer: { mode: "voice", audio: blob, durationSec } };
    }
    const sent = submission ?? { questionId: question!.id, attemptNo, key: crypto.randomUUID(), answer: { mode: "typed", text: text.trim() } };
    void mutate(async (signal) => {
      setUncertain(sent);
      try {
        if (sent.answer.mode === "voice") await submitPreviewVoiceAnswer(sessionId, sent.questionId, sent.attemptNo, sent.answer.audio, sent.answer.durationSec, sent.key, signal);
        else await submitPreviewAnswer(sessionId, sent.questionId, sent.attemptNo, sent.answer.text, sent.key, signal);
      } catch (failure) {
        // A definite validation/access rejection leaves the draft editable. Network/5xx
        // failures retain the exact payload/key because the write may have committed.
        if (!signal.aborted && failure instanceof ApiError && failure.status >= 400 && failure.status < 500 && failure.status !== 409) setUncertain(null);
        throw failure;
      }
      if (signal.aborted) return;
      setUncertain(null);
      clearDrafts();
      setLoading(true);
      setTick((value) => value + 1);
    });
  }

  return <div className="flex max-w-3xl flex-col gap-5 text-ink">
    <div className="flex flex-col items-start gap-2">
      <h2 className="text-base font-semibold">Test interview</h2>
      <p className="text-sm text-ink-muted">Practise the approved questions with real AI feedback. Test sessions are excluded from candidate reports and statistics. Answer by voice or by typing; voice answers go through the real transcription pipeline.</p>
      <ButtonLink href={`${base}/preview`} size="sm">Back to content preview</ButtonLink>
    </div>
    {error && <div role="alert" className="flex flex-col items-start gap-2 text-sm text-error"><p>{error}</p>{sessionId && <Button disabled={busy} onClick={() => { setError(null); setLoading(true); setTick((value) => value + 1); }}>Check session status</Button>}</div>}
    {!sessionId && <div className="flex flex-col items-start gap-4">
      <div className="flex items-start gap-3"><Checkbox checked={consent} onChange={setConsent} label={PREVIEW_CONSENT} disabled={busy} /><p className="text-sm">{PREVIEW_CONSENT}</p></div>
      <Button variant="primary" disabled={busy || !consent || role.status === "archived"} onClick={() => void mutate(async (signal) => {
        const started = await startPreview(role.id, answerMode, signal);
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
        {result && <Feedback attempt={result.first} audio={feedbackAudio(result.first)} />}
        {voiceSupported && <SegmentedControl label="Answer mode" options={MODE_OPTIONS} value={answerMode} onChange={chooseMode} />}
        {(!voiceSupported || micUnavailable) && <p role="status" className="text-sm text-ink-muted">{MIC_UNAVAILABLE}</p>}
        {answerMode === "voice" ? <div ref={voicePanel} role="group" aria-label={result ? "Your improved answer (voice)" : "Your answer (voice)"} className="flex flex-col gap-3">
          {recorder.state.status === "stopped" ? <>
            <audio aria-label="Your recording, before submitting" controls src={recorder.state.recording.url} className="w-full" />
            <p className="text-sm text-ink-muted">Recorded {mmss(recorder.state.recording.durationSec)}. Listen back, then submit or re-record.</p>
            {recorder.state.reason !== "manual" && <p role="status" className="text-sm">Recording stopped at the {recorder.state.reason === "time" ? "5:00 time" : "25 MB size"} limit.</p>}
          </> : <div className="flex flex-wrap items-center gap-3">
            <Button ref={recordButton} variant={recording ? "destructive" : "primary"} disabled={recording ? false : blocked || recorderStatus === "requesting"} onClick={recording ? recorder.stop : () => void recorder.start()}>
              {recording ? "Stop recording" : recorderStatus === "requesting" ? "Waiting for microphone…" : "Record answer"}
            </Button>
            <span role="timer" className="font-mono text-sm tabular-nums text-ink-muted"><span className="sr-only">Recording time </span>{mmss(recording ? recorder.elapsedSec : 0)} / {mmss(MAX_RECORDING_SEC)}</span>
          </div>}
          {recorder.state.status === "error" && <p role="alert" className="text-sm text-error">{recorder.state.message}</p>}
        </div> : <Field label={result ? "Your improved answer" : "Your answer"} helper={`${text.length}/1500 characters`}>
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={text} maxLength={1500} disabled={blocked} rows={6} onChange={(event) => setText(event.target.value)} />}
        </Field>}
        <div className="flex flex-wrap gap-2">
          {answerMode === "voice" ? <>
            <Button ref={voiceSubmitButton} variant="primary" disabled={blocked || recorderStatus !== "stopped"} onClick={() => submit()}>{busy && uncertain?.answer.mode === "voice" ? "Uploading…" : `Submit try ${attemptNo}`}</Button>
            {recorderStatus === "stopped" && <Button disabled={blocked} onClick={() => void recorder.start()}>Re-record</Button>}
          </> : <Button variant="primary" disabled={blocked || !text.trim()} onClick={() => submit()}>Submit try {attemptNo}</Button>}
          {result && !active.failed && <Button disabled={blocked || recording} onClick={() => void mutate(async (signal) => { await skipPreviewRetry(sessionId!, question.id, signal); if (!signal.aborted) { clearDrafts(); setLoading(true); setTick((value) => value + 1); } })}>Skip retry</Button>}
        </div>
      </section> : <Button variant="primary" disabled={blocked || Boolean(active.failed)} onClick={() => void mutate(async (signal) => {
        const report = await completePreview(sessionId!, signal);
        if (!signal.aborted) setSession(report);
      })}>{busy ? "Completing…" : "Complete test and view results"}</Button>}
      <Button disabled={busy || loading} onClick={() => void mutate(async (signal) => { await abandonPreview(sessionId!, signal); if (!signal.aborted) { keepSession(null); setSession(null); setUncertain(null); clearDrafts(); } })}>Abandon test interview</Button>
    </>}
    {session && !isPreviewInProgress(session) && <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Test complete · {session.score}/100</h3>
      <p className="text-sm">{session.bandMessage}</p>
      {session.strengths.length > 0 && <div><h4 className="text-sm font-semibold">Strengths</h4><ul className="list-disc pl-5 text-sm">{session.strengths.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.focus.length > 0 && <div><h4 className="text-sm font-semibold">Focus areas</h4><ul className="list-disc pl-5 text-sm">{session.focus.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.results.map((row) => <div key={row.question.id} className="flex flex-col gap-3"><h4 className="text-sm font-semibold">{row.question.index}. {row.question.text}</h4><Feedback attempt={row.first} audio={feedbackAudio(row.first)} />{row.second ? <Feedback attempt={row.second} audio={feedbackAudio(row.second)} /> : <p className="text-sm text-ink-muted">Retry skipped.</p>}</div>)}
      <Button onClick={() => { keepSession(null); setSession(null); setError(null); }}>Start another test</Button>
    </section>}
  </div>;
}
