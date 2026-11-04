"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  abandonPreview, choosePreviewRetry, completePreview, getPreview, isPreviewInProgress, previewAnswerDone,
  repeatPreviewQuestion, setPreviewPaused, skipPreviewRetry,
  type PreviewAttempt, type PreviewEvent, type PreviewInProgress, type PreviewReport,
} from "@/services/preview";
import type { Segment } from "./call-header";
import { CallMessage, callButton } from "./call-parts";
import { CallScreen } from "./call-screen";
import { FeedbackCard } from "./feedback-card";
import { improvedRows } from "./feedback-model";
import { LeaveDialog } from "./leave-dialog";
import type { OrbMode } from "./orb";
import type { TranscriptEntry } from "./transcript-drawer";
import { useLiveInterview } from "./use-live-interview";
import { useSessionEvents } from "./use-session-events";

/** After the last answer, wait for the interviewer's closing words before hanging up. */
const WRAP_UP_QUIET_MS = 2000;
const WRAP_UP_SILENT_START_MS = 8000;
const WRAP_UP_CAP_MS = 45_000;
/** Polls the session while an answer is being scored; events usually settle it sooner. */
const PENDING_POLL_MS = 2500;

type ScoredTry = { key: string; at: number; questionId: string; attemptNo: 1 | 2; attempt: PreviewAttempt; followUp: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The interviewer's recommendation after a try; mirrors the server's rule for feedback that predates the field. */
function recommendationOf(t: ScoredTry): "retry" | "next" {
  const r = t.attempt.feedback.recommendation;
  if (r) return r;
  return t.attemptNo === 2 ? "next" : t.followUp || t.attempt.feedback.score < 85 ? "retry" : "next";
}

/**
 * The live test interview as a full-screen call (same behaviour as the candidate call), on an admin-owned
 * preview session. The interviewer asks, listens, gives feedback and offers a second try by voice; this
 * screen shows the question, captions, written feedback and the call controls. Question and attempt state is
 * always reconciled with the server (GET /sessions/:id), accelerated by session events and polled while an
 * answer is scored. When every question is answered it completes the session and hands over the report.
 * Renders inside the call overlay.
 */
export function TestCall({ sessionId, previewHref, onLeft, onAbandoned, onCompleted }: {
  sessionId: string;
  previewHref: string;
  /** Hung up; the session stays open to resume. */
  onLeft: () => void;
  /** The test session was abandoned. */
  onAbandoned: () => void;
  /** The session is complete (here or elsewhere). */
  onCompleted: (report: PreviewReport) => void;
}) {
  const router = useRouter();
  const live = useLiveInterview(sessionId);
  const { status: liveStatus, problem: liveProblem, captions, muted, interviewerSpeaking, audioRef, connect, hangUp, serverEnded, isInterviewerSpeaking, isConnected } = live;
  const [view, setView] = useState<PreviewInProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [latest, setLatest] = useState<ScoredTry | null>(null);
  /** Every try scored while this page was open, for the transcript. */
  const [scored, setScored] = useState<ScoredTry[]>([]);
  /** Questions whose second try was chosen (button or voice). Absent: the choice is pending. */
  const [retryChosen, setRetryChosen] = useState<Record<string, true>>({});
  const [choicePending, setChoicePending] = useState<"retry" | "next" | null>(null);
  /** A second try's card that was closed. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** Captions from before these times belong to an earlier try / question. */
  const [tryFrom, setTryFrom] = useState(0);
  const [questionFrom, setQuestionFrom] = useState(0);
  const [paused, setPausedState] = useState(false);
  const [pausePending, setPausePending] = useState(false);
  const [repeatPending, setRepeatPending] = useState(false);
  const [answerDonePending, setAnswerDonePending] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const mounted = useRef(true);
  /** Aborted when this call goes away; every request made from here uses its signal. */
  const lifecycle = useRef<AbortController | null>(null);
  /** Only one of leave / abandon / back to preview runs at a time. */
  const exitLock = useRef(false);
  const readSequence = useRef(0);
  const appliedSequence = useRef(0);
  const readQueue = useRef<Promise<unknown>>(Promise.resolve());
  const autoConnected = useRef(false);
  const wrapUpStarted = useRef(false);
  const finishingRef = useRef(false);
  const currentQuestionId = useRef<string | null>(null);
  const completed = useRef(onCompleted);
  useEffect(() => { completed.current = onCompleted; }, [onCompleted]);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  const signal = () => lifecycle.current?.signal;

  const reconcile = useCallback(async (abort?: AbortSignal) => {
    const sequence = ++readSequence.current;
    // Serialize event, poll and foreground reads; a post-mutation read always observes a fresh request.
    const request = readQueue.current.catch(() => {}).then(() => { abort?.throwIfAborted(); return getPreview(sessionId, abort); });
    readQueue.current = request;
    const next = await request;
    abort?.throwIfAborted();
    if (!mounted.current || sequence < appliedSequence.current) return next;
    appliedSequence.current = sequence;
    if (!isPreviewInProgress(next)) {
      // Completed elsewhere (or opened after completion): the summary takes over. Completing here hands it over itself.
      if (!finishingRef.current) completed.current(next);
      return next;
    }
    const qid = next.questions.find((q) => q.index === next.currentQuestion)?.id ?? null;
    if (qid !== currentQuestionId.current) {
      currentQuestionId.current = qid;
      const now = Date.now();
      setQuestionFrom(now); setTryFrom(now);
    }
    setView(next);
    return next;
  }, [sessionId]);

  const { setPaused: setLivePausedLocal } = live;
  const applyPaused = useCallback((next: boolean) => { setPausedState(next); setLivePausedLocal(next); }, [setLivePausedLocal]);
  const markRetry = useCallback((questionId: string) => {
    setRetryChosen((c) => ({ ...c, [questionId]: true }));
    setTryFrom(Date.now());
  }, []);

  const onEvent = useCallback((event: PreviewEvent) => {
    switch (event.type) {
      case "attempt.received":
        setNotice(null); setLatest(null); setTryFrom(Date.now());
        return;
      case "attempt.evaluated": {
        const t: ScoredTry = { key: event.attemptId, at: Date.now(), questionId: event.questionId, attemptNo: event.attemptNo, attempt: event.attempt, followUp: event.followUp ?? null };
        setLatest(t);
        setScored((list) => (list.some((s) => s.key === t.key) ? list : [...list, t]));
        return;
      }
      case "attempt.failed":
        setNotice("We couldn't score that answer because of a technical problem. The interviewer will ask you to answer again.");
        return;
      // A choice ends a pause on the server too (LIVE_INTERVIEW_CONTRACT.md), so the mic goes back on.
      case "question.retry_skipped":
        setLatest((l) => (l?.questionId === event.questionId ? null : l));
        applyPaused(false);
        return;
      case "live.retry_chosen":
        markRetry(event.questionId);
        applyPaused(false);
        return;
      case "live.paused":
        applyPaused(event.paused);
        return;
      case "live.ended":
        serverEnded(event.reason);
        return;
      default:
        return;
    }
  }, [serverEnded, markRetry, applyPaused]);

  useSessionEvents(sessionId, reconcile, onEvent);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void Promise.resolve().then(() => reconcile(controller.signal))
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e, "Could not load the test interview.")); });
    return () => { mounted.current = false; controller.abort(); };
  }, [reconcile]);

  // Events usually settle a scored answer; polling covers missed frames.
  const pending = !!view?.pending;
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => { void reconcile(controller.signal).catch(() => {}); }, PENDING_POLL_MS);
    return () => { clearInterval(timer); controller.abort(); };
  }, [pending, reconcile]);

  const question = view?.questions.find((q) => q.index === view.currentQuestion) ?? view?.questions[view.questions.length - 1];
  const currentResult = view?.results.find((r) => r.question.id === question?.id);
  const allDone = !!view && view.results.length === view.questions.length && view.results.every((r) => r.state === "done");

  // Join the live interview once the session is known to be unfinished.
  useEffect(() => {
    if (!view || allDone || autoConnected.current) return;
    autoConnected.current = true;
    void Promise.resolve().then(connect);
  }, [view, allDone, connect]);

  // A new live connection starts unpaused on the server: if the call is still paused here, tell it again.
  const wasLive = useRef(false);
  useEffect(() => {
    const isLiveNow = liveStatus === "live";
    if (isLiveNow && !wasLive.current && paused) void setPreviewPaused(sessionId, true, lifecycle.current?.signal).catch(() => {});
    wasLive.current = isLiveNow;
  }, [liveStatus, paused, sessionId]);

  // 409 from POST /live: the interview finished or is no longer in progress. The server state decides what to show.
  const problemKind = liveProblem?.kind;
  useEffect(() => {
    if (problemKind === "not_available") void reconcile().catch(() => {});
  }, [problemKind, reconcile]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true); setFinishError(null);
    try {
      await hangUp();
      const next = await completePreview(sessionId, lifecycle.current?.signal);
      if (!isPreviewInProgress(next)) { completed.current(next); return; }
      if (mounted.current) setFinishError("The test session isn't finished yet. Try again in a moment.");
    } catch (e) {
      if (lifecycle.current?.signal.aborted) return;
      try { const next = await reconcile(); if (!isPreviewInProgress(next)) { completed.current(next); return; } } catch { /* completion can be retried after server reconciliation */ }
      if (mounted.current) setFinishError(message(e, "Could not finish the test session. Check your connection and try again."));
    } finally {
      finishingRef.current = false;
      if (mounted.current) setFinishing(false);
    }
  }, [sessionId, hangUp, reconcile]);

  // Every question is done: let the interviewer finish its last feedback and goodbye, then hang up and complete.
  useEffect(() => {
    if (!allDone || wrapUpStarted.current) return;
    wrapUpStarted.current = true;
    void (async () => {
      const started = Date.now();
      let spoke = false;
      let quietSince = started;
      // Nothing to wait for without a live interviewer (for example after a reload).
      while (isConnected() && mounted.current && !finishingRef.current && Date.now() - started < WRAP_UP_CAP_MS) {
        await sleep(250);
        const now = Date.now();
        if (isInterviewerSpeaking()) { spoke = true; quietSince = now; }
        else if (spoke ? now - quietSince >= WRAP_UP_QUIET_MS : now - started >= WRAP_UP_SILENT_START_MS) break;
      }
      if (mounted.current) await finish();
    })();
  }, [allDone, isInterviewerSpeaking, isConnected, finish]);

  async function sendAnswerDone() {
    if (answerDonePending) return;
    setAnswerDonePending(true);
    try { await previewAnswerDone(sessionId, signal()); }
    catch (e) { if (!signal()?.aborted) setNotice(message(e, "Could not reach the server. The interviewer is still listening; try again.")); }
    finally { if (mounted.current) setAnswerDonePending(false); }
  }

  async function retry() {
    if (!question || choicePending) return;
    setChoicePending("retry"); setNotice(null);
    try { await choosePreviewRetry(sessionId, signal()); markRetry(question.id); }
    catch (e) {
      if (signal()?.aborted) return;
      void reconcile().catch(() => {});
      setNotice(message(e, "Could not start the second try. Say “again”, or try the button once more."));
    }
    finally { if (mounted.current) setChoicePending(null); }
  }

  async function skip() {
    if (!question || choicePending) return;
    setChoicePending("next"); setNotice(null);
    try { await skipPreviewRetry(sessionId, question.id, signal()); setLatest(null); await reconcile(); }
    catch (e) {
      if (signal()?.aborted) return;
      try {
        const next = await reconcile();
        if (!isPreviewInProgress(next) || next.results.find((r) => r.question.id === question.id)?.state === "done") return;
      } catch { /* keep the button available until the skip is confirmed */ }
      setNotice(message(e, "Could not move to the next question. Please try again."));
    }
    finally { if (mounted.current) setChoicePending(null); }
  }

  async function togglePause() {
    if (pausePending) return;
    const next = !paused;
    setPausePending(true); setNotice(null);
    try { await setPreviewPaused(sessionId, next, signal()); applyPaused(next); }
    catch (e) { if (!signal()?.aborted) setNotice(message(e, next ? "Could not pause. Try again." : "Could not resume. Try again.")); }
    finally { if (mounted.current) setPausePending(false); }
  }

  async function repeat() {
    if (repeatPending) return;
    setRepeatPending(true); setNotice(null);
    try { await repeatPreviewQuestion(sessionId, signal()); }
    catch (e) { if (!signal()?.aborted) setNotice(message(e, "Could not ask for the question again. You can also just say “Can you repeat that?”")); }
    finally { if (mounted.current) setRepeatPending(false); }
  }

  /** Runs one way out of the call (leave, abandon, back to preview) at a time. */
  async function exit(action: () => Promise<void>) {
    if (exitLock.current) return;
    exitLock.current = true;
    try { await action(); } finally { exitLock.current = false; }
  }

  const leave = () => exit(async () => { await hangUp(); onLeft(); });

  const abandon = () => exit(async () => {
    try { await hangUp(); await abandonPreview(sessionId, signal()); onAbandoned(); }
    catch (e) {
      if (signal()?.aborted) return;
      setLeaveOpen(false);
      setNotice(message(e, "Could not abandon this test interview. Please try again."));
    }
  });

  const backToPreview = () => exit(async () => { await hangUp(); router.push(previewHref); });

  // Kept at a stable position so the interviewer's audio survives screen changes (for example its goodbye).
  const audio = <audio ref={audioRef} autoPlay hidden />;
  const back = <Link href={previewHref} className={callButton.secondary}>Back to content preview</Link>;
  const shell = (body: ReactNode) => <>{audio}{body}</>;

  if (!view) {
    return shell(error
      ? (
        <CallMessage tone="error" title="We couldn't load the test interview" body={error}>
          <button type="button" className={callButton.primary} onClick={() => { setError(null); void reconcile().catch((e: unknown) => setError(message(e, "Could not reconnect."))); }}>Try again</button>
          {back}
        </CallMessage>
      )
      : <CallMessage busy title="Loading the test interview…" />);
  }
  if (allDone && (finishing || finishError || liveStatus !== "live")) {
    return shell(finishError && !finishing
      ? (
        <CallMessage tone="error" title="We couldn't finish the test session" body={finishError}>
          <button type="button" className={callButton.primary} onClick={() => void finish()}>Try again</button>
          {back}
        </CallMessage>
      )
      : <CallMessage busy title="Generating the results…" body="This usually takes under a minute." />);
  }
  if (!question) {
    return shell(<CallMessage tone="error" title="No question available" body="This test interview has no available question. Check the role's approved questions.">{back}</CallMessage>);
  }

  const awaitingRetry = currentResult?.state === "awaiting_retry";
  const secondTry = awaitingRetry && !!retryChosen[question.id];
  const reconnecting = live.autoReconnecting || (liveStatus === "connecting" && live.callStartedAt !== null);
  const isLive = liveStatus === "live";

  // The latest scored try from the event; after a reload, the first try of a question awaiting its retry.
  const shown: ScoredTry | null = view.pending ? null
    : latest ?? (awaitingRetry && currentResult ? { key: `${question.id}-1`, at: 0, questionId: question.id, attemptNo: 1, attempt: currentResult.first, followUp: currentResult.followUp ?? null } : null);
  const lastCandidate = captions.findLast((c) => c.speaker === "candidate");
  const cardUp = !!shown && (shown.attemptNo === 1
    ? shown.questionId === question.id && awaitingRetry && !retryChosen[question.id]
    : dismissed !== shown.key && !(lastCandidate && lastCandidate.at > shown.at));
  const shownNumber = shown ? view.questions.find((q) => q.id === shown.questionId)?.index ?? question.index : question.index;
  const firstTry = shown?.attemptNo === 2
    ? view.results.find((r) => r.question.id === shown.questionId)?.first ?? scored.find((s) => s.questionId === shown.questionId && s.attemptNo === 1)?.attempt
    : undefined;
  const card = cardUp && shown ? (
    <FeedbackCard
      key={shown.key}
      questionNumber={shownNumber}
      attemptNo={shown.attemptNo}
      attempt={shown.attempt}
      improved={firstTry ? improvedRows(firstTry, shown.attempt) : []}
      followUp={shown.followUp}
      choice={shown.attemptNo === 1 ? { recommended: recommendationOf(shown), pending: choicePending, onRetry: () => void retry(), onNext: () => void skip() } : null}
      onDismiss={shown.attemptNo === 2 ? () => setDismissed(shown.key) : undefined}
    />
  ) : null;

  const orbMode: OrbMode = !isLive ? "offline" : paused ? "waiting" : interviewerSpeaking ? "speaking" : view.pending ? "waiting" : "listening";
  const stateLabel = !isLive ? (reconnecting ? "Reconnecting…" : liveStatus === "lost" || liveStatus === "ended" ? "Disconnected" : "Connecting…")
    : paused ? "Waiting"
      : interviewerSpeaking ? (cardUp ? "Giving feedback" : "Speaking")
        : view.pending ? "Scoring your answer"
          : "Listening";
  const problem = liveStatus === "lost" && !live.autoReconnecting ? liveProblem?.message ?? null
    : liveStatus === "ended" ? "You left the live interview. Reconnect to continue." : null;
  const failedNotice = view.failed && !view.pending ? "The last answer couldn't be scored. The interviewer will ask you to answer again." : null;

  const segments: Segment[] = [...view.questions].sort((a, b) => a.index - b.index).map((q) => {
    const r = view.results.find((x) => x.question.id === q.id);
    return {
      state: q.index === view.currentQuestion ? "current" : r?.state === "done" || q.index < view.currentQuestion ? "done" : "future",
      retried: !!r?.second || (q.id === question.id && secondTry),
    };
  });

  const lastInterviewer = captions.findLast((c) => c.speaker === "interviewer");
  const you = lastCandidate && lastCandidate.at >= questionFrom ? lastCandidate : null;
  const tryStartedAt = captions.find((c) => c.speaker === "candidate" && c.at >= tryFrom)?.at ?? null;
  const transcript: TranscriptEntry[] = [
    ...captions.map((c): TranscriptEntry => ({ kind: "line", id: `c${c.id}`, at: c.at, speaker: c.speaker, text: c.text, interrupted: c.interrupted })),
    ...scored.flatMap((s): TranscriptEntry[] => {
      const n = view.questions.find((q) => q.id === s.questionId)?.index;
      return n ? [{ kind: "feedback", id: `f${s.key}`, at: s.at, questionNumber: n, attemptNo: s.attemptNo, attempt: s.attempt }] : [];
    }),
  ].sort((a, b) => a.at - b.at);

  return shell(
    <>
      <CallScreen
        connection={isLive ? "live" : live.callStartedAt !== null ? "reconnecting" : "connecting"}
        connected={isLive}
        callStartedAt={live.callStartedAt}
        segments={segments}
        questionNumber={question.index}
        questionText={question.text}
        secondTry={secondTry}
        followUp={secondTry ? currentResult?.followUp ?? null : null}
        orbMode={orbMode}
        stateLabel={stateLabel}
        remoteLevel={live.remoteLevel}
        micLevel={live.micLevel}
        ai={lastInterviewer ? { text: lastInterviewer.text, interrupted: !!lastInterviewer.interrupted } : null}
        you={you ? { text: you.text, updatedAt: you.updatedAt } : null}
        tryStartedAt={tryStartedAt}
        candidateSpeaking={live.candidateSpeaking}
        awaitingAnswer={isLive && !paused && !view.pending && !interviewerSpeaking && !cardUp && !allDone}
        answerDonePending={answerDonePending}
        onAnswerDone={() => void sendAnswerDone()}
        muted={muted}
        mutedSpeech={live.mutedSpeech}
        noisy={live.noisy}
        paused={paused}
        pausePending={pausePending}
        repeatPending={repeatPending}
        card={card}
        reconnecting={reconnecting}
        problem={problem}
        onReconnect={() => { setNotice(null); void connect(); }}
        audioBlocked={live.audioBlocked}
        onResumeAudio={live.resumeAudio}
        notice={error ?? notice ?? failedNotice}
        transcript={transcript}
        shortcutsPaused={leaveOpen}
        onToggleMute={() => live.setMuted(!muted)}
        onTogglePause={() => void togglePause()}
        onRepeat={() => void repeat()}
        onLeave={() => setLeaveOpen(true)}
      />
      <LeaveDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        questionNumber={question.index}
        onLeave={leave}
        onAbandon={abandon}
        onBackToPreview={backToPreview}
      />
    </>,
  );
}
