"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import {
  PREVIEW_CONSENT, abandonPreview, completePreview, getPreview, isPreviewInProgress, previewAnswerDone,
  previewEventsUrl, previewPollDelay, skipPreviewRetry, startPreview,
  type PreviewAttempt, type PreviewSession,
} from "@/services/preview";
import { useRole } from "./role-context";
import { useLiveInterview, type LiveStatus } from "./use-live-interview";

const message = (error: unknown) => error instanceof Error ? error.message : "The request failed. Try again.";
/** Safety net for missed socket frames while the live voice is running. */
const LIVE_REFRESH_MS = 10_000;
const EVENTS = new Set(["attempt.received", "attempt.evaluated", "attempt.failed", "question.retry_skipped", "live.answer_done", "live.ended"]);

const STATUS_LABEL: Record<LiveStatus, string> = { idle: "Not connected", connecting: "Connecting…", live: "Live", dropped: "Disconnected", closed: "Hung up" };
function endedMessage(reason: string | null): string {
  if (reason === "expired") return "The live voice session timed out.";
  if (reason === "connection_lost") return "The connection to the interviewer was lost.";
  return `The live voice session ended${reason && reason !== "closed" ? ` (${reason})` : ""}.`;
}

function Feedback({ attempt }: { attempt: PreviewAttempt }) {
  return <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
    <h5 className="text-sm font-semibold">{attempt.attemptNo === 1 ? "First try" : "Second try"} · {attempt.feedback.score}/100</h5>
    <p className="whitespace-pre-wrap text-sm text-ink-muted">{attempt.transcript}</p>
    <p className="text-sm">{attempt.feedback.opener}</p>
    {attempt.feedback.worked.length > 0 && <div><h6 className="text-sm font-semibold">What worked</h6><ul className="list-disc pl-5 text-sm">{attempt.feedback.worked.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {attempt.feedback.improve.length > 0 && <div><h6 className="text-sm font-semibold">Improve next time</h6><ul className="list-disc pl-5 text-sm">{attempt.feedback.improve.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
  </section>;
}

/** Decorative input level from the live microphone stream; writes to the DOM to avoid re-rendering per frame. */
function MicLevel({ stream }: { stream: MediaStream | null }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = bar.current;
    if (!stream || typeof window.AudioContext === "undefined") return;
    const context = new window.AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const draw = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
      if (node) node.style.width = `${Math.min(100, (peak / 128) * 250)}%`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
      if (node) node.style.width = "0%";
    };
  }, [stream]);
  return <div aria-hidden="true" className="flex items-center gap-2 text-xs text-ink-faint">
    Mic
    <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-line"><div ref={bar} className="h-full w-0 rounded-sm bg-primary transition-[width] duration-75" /></div>
  </div>;
}

/** Admin route for FR-ROLE-07: the same live voice interview candidates get, on an admin-owned session. */
export function PreviewInterview() {
  const role = useRole();
  const router = useRouter();
  const search = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(search.get("session"));
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mutationLock = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const captionsBox = useRef<HTMLDivElement>(null);
  const { status: liveStatus, error: liveError, endReason, captions, muted, mic, audioRef, connect, hangUp, setMute, serverEnded } = useLiveInterview(sessionId);
  const base = `/roles/${encodeURIComponent(role.id)}`;
  const refresh = () => setTick((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  // Session state is the source of truth; poll while an answer is being scored.
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
          if (!isPreviewInProgress(fresh) || !fresh.pending) return;
          await previewPollDelay(controller.signal);
        }
        setError("Scoring is still running. Check session status in a moment.");
      } catch (failure) {
        if (!controller.signal.aborted) { setError(message(failure)); setLoading(false); }
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId, tick]);

  const inProgress = Boolean(session && isPreviewInProgress(session));
  const liveRunning = liveStatus === "live" || liveStatus === "connecting";

  // Session events (attempt.*, live.ended) accelerate the GETs above; reconnects with backoff.
  const onEvent = useRef<(event: { type: string; reason?: unknown }) => void>(() => {});
  useEffect(() => {
    onEvent.current = (event) => {
      if (event.type === "attempt.received") setNotice("Answer received. Scoring…");
      else if (event.type === "attempt.evaluated") setNotice(null);
      else if (event.type === "attempt.failed") setNotice("That answer couldn't be scored. The interviewer will ask you to answer again.");
      else if (event.type === "live.ended") serverEnded(typeof event.reason === "string" ? event.reason : "closed");
      setTick((value) => value + 1);
    };
  });
  useEffect(() => {
    if (!sessionId || !inProgress) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry = 0;
    let failures = 0;
    function open() {
      if (stopped) return;
      socket = new WebSocket(previewEventsUrl(sessionId!));
      socket.onopen = () => { failures = 0; };
      socket.onmessage = (frame) => {
        if (typeof frame.data !== "string") return;
        try {
          const event: unknown = JSON.parse(frame.data);
          if (event && typeof event === "object" && "type" in event && typeof event.type === "string" && EVENTS.has(event.type)) onEvent.current(event as { type: string });
        } catch { /* malformed frames are ignored; polling reconciles */ }
      };
      socket.onclose = () => {
        if (stopped) return;
        retry = window.setTimeout(open, Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)));
      };
      socket.onerror = () => socket?.close();
    }
    open();
    return () => { stopped = true; window.clearTimeout(retry); socket?.close(); };
  }, [sessionId, inProgress]);

  // Polling fallback while talking, in case a socket frame was missed.
  useEffect(() => {
    if (!sessionId || !inProgress || liveStatus !== "live") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [sessionId, inProgress, liveStatus]);

  // The interview finished elsewhere (report loaded): release the mic and peer connection.
  const finished = Boolean(session && !isPreviewInProgress(session));
  useEffect(() => {
    if (finished && liveRunning) void hangUp();
  }, [finished, liveRunning, hangUp]);

  useEffect(() => {
    const box = captionsBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [captions]);

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
        // A lost response may still have committed on the server.
        if (sessionId) refresh();
      }
    } finally {
      mutationLock.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  const active = session && isPreviewInProgress(session) ? session : null;
  const question = active?.questions.find((item) => item.index === active.currentQuestion);
  const result = question ? active?.results.find((item) => item.question.id === question.id) : undefined;
  const secondTry = result?.state === "awaiting_retry";
  const allAnswered = Boolean(active && !question);
  const answeredResults = active?.results.filter((row) => row.first) ?? [];

  function endPreview() {
    void mutate(async (signal) => {
      await hangUp();
      if (signal.aborted) return;
      if (!allAnswered) { setNotice("Live voice ended. Every question needs an answer before results are available: reconnect to continue, or abandon the test."); return; }
      const report = await completePreview(sessionId!, signal);
      if (!signal.aborted) { setNotice(null); setSession(report); }
    });
  }

  return <div className="flex max-w-3xl flex-col gap-5 text-ink">
    {/* Remote interviewer voice. */}
    <audio ref={audioRef} autoPlay className="hidden" />
    <div className="flex flex-col items-start gap-2">
      <h2 className="text-base font-semibold">Test interview</h2>
      <p className="text-sm text-ink-muted">Practise the approved questions in the same live voice interview candidates get, with real AI scoring and feedback. Test sessions are excluded from candidate reports and statistics.</p>
      <ButtonLink href={`${base}/preview`} size="sm">Back to content preview</ButtonLink>
    </div>
    {error && <div role="alert" className="flex flex-col items-start gap-2 text-sm text-error"><p>{error}</p>{sessionId && <Button disabled={busy} onClick={() => { setError(null); setLoading(true); refresh(); }}>Check session status</Button>}</div>}
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
      <section aria-label="Live interview" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className={cn("size-2 rounded-full", liveStatus === "live" ? "bg-primary" : liveStatus === "connecting" ? "bg-improve" : "bg-ink-faint")} />
            {STATUS_LABEL[liveStatus]}{liveStatus === "live" && muted ? " · Muted" : ""}
          </p>
          {liveStatus === "live" && <MicLevel stream={muted ? null : mic} />}
        </div>
        {liveStatus === "dropped" && endReason && <p className="text-sm text-ink-muted">{endedMessage(endReason)}</p>}
        {liveError && <p role="alert" className="text-sm text-error">{liveError}</p>}

        {question ? <div className="flex flex-col gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            Question {question.index} of {active.questions.length}
            {secondTry && <span className="rounded-chip bg-primary-tint px-2.5 py-[3px] text-xs font-semibold text-primary-text">Second try</span>}
          </h3>
          <p className="text-sm">{question.text}</p>
          {secondTry && result?.followUp && <p className="text-sm"><span className="font-semibold">Follow-up: </span>{result.followUp}</p>}
        </div> : <p className="text-sm">Every question is answered. End the preview to see the results.</p>}

        {active.pending && <p role="status" className="text-sm text-ink-muted">Scoring try {active.pending.attemptNo}…</p>}
        {active.failed && <p role="alert" className="text-sm text-error">Scoring failed ({active.failed.code}). The interviewer will ask for the answer again.</p>}
        {notice && !active.pending && <p role="status" className="text-sm text-ink-muted">{notice}</p>}

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">Live captions</h4>
          <div ref={captionsBox} role="log" aria-live="polite" aria-label="Live captions" className="flex max-h-64 min-h-16 flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-surface-sunken p-3 text-sm">
            {captions.length === 0
              ? <p className="text-ink-faint">{liveRunning ? "Captions appear here as you and the interviewer speak." : "Join the interview to start talking."}</p>
              : captions.map((caption) => <p key={caption.id}><span className={cn("font-semibold", caption.speaker === "interviewer" ? "text-primary-text" : "text-ink")}>{caption.speaker === "interviewer" ? "Interviewer" : "You"}: </span>{caption.text}</p>)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {liveStatus === "live" || liveStatus === "connecting" ? <>
            <Button aria-pressed={muted} disabled={liveStatus !== "live"} onClick={() => setMute(!muted)}>{muted ? "Unmute" : "Mute"}</Button>
            {question && <Button variant="primary" disabled={busy || liveStatus !== "live" || Boolean(active.pending)} onClick={() => void mutate(async (signal) => { await previewAnswerDone(sessionId!, signal); if (!signal.aborted) refresh(); })}>I&apos;m done answering</Button>}
          </> : question && <Button variant="primary" disabled={busy} onClick={() => void connect()}>{liveStatus === "idle" ? "Join live interview" : "Reconnect"}</Button>}
          {question && secondTry && !active.failed && <Button disabled={busy || Boolean(active.pending)} onClick={() => void mutate(async (signal) => { await skipPreviewRetry(sessionId!, question.id, signal); if (!signal.aborted) refresh(); })}>Skip second try</Button>}
        </div>
      </section>

      {answeredResults.length > 0 && <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Written feedback</h3>
        {answeredResults.map((row) => <div key={row.question.id} className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">{row.question.index}. {row.question.text}</h4>
          <Feedback attempt={row.first} />
          {row.second && <Feedback attempt={row.second} />}
        </div>)}
      </section>}

      <div className="flex flex-wrap gap-2">
        <Button variant={allAnswered ? "primary" : "secondary"} disabled={busy || loading || Boolean(active.pending)} onClick={endPreview}>{busy ? "Ending…" : allAnswered ? "End preview and view results" : "End preview"}</Button>
        <Button variant="destructive" disabled={busy || loading} onClick={() => void mutate(async (signal) => {
          await hangUp();
          await abandonPreview(sessionId!, signal);
          if (!signal.aborted) { keepSession(null); setSession(null); setNotice(null); }
        })}>Abandon test interview</Button>
      </div>
    </>}
    {session && !isPreviewInProgress(session) && <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Test complete · {session.score}/100</h3>
      <p className="text-sm">{session.bandMessage}</p>
      {session.strengths.length > 0 && <div><h4 className="text-sm font-semibold">Strengths</h4><ul className="list-disc pl-5 text-sm">{session.strengths.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.focus.length > 0 && <div><h4 className="text-sm font-semibold">Focus areas</h4><ul className="list-disc pl-5 text-sm">{session.focus.map((point, i) => <li key={i}>{point.text}</li>)}</ul></div>}
      {session.results.map((row) => <div key={row.question.id} className="flex flex-col gap-3"><h4 className="text-sm font-semibold">{row.question.index}. {row.question.text}</h4><Feedback attempt={row.first} />{row.second ? <Feedback attempt={row.second} /> : <p className="text-sm text-ink-muted">Second try skipped.</p>}</div>)}
      <Button onClick={() => { keepSession(null); setSession(null); setError(null); }}>Start another test</Button>
    </section>}
  </div>;
}
