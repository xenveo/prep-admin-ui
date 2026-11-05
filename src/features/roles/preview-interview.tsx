"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPreview, isPreviewInProgress, startPreview, type PreviewInProgress, type PreviewReport } from "@/services/preview";
import { CallMessage, CallOverlay } from "./live-call/call-parts";
import { CallSummary } from "./live-call/call-summary";
import { Lobby } from "./live-call/lobby";
import { TestCall } from "./live-call/test-call";
import { useRole } from "./role-context";

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/**
 * Admin route for FR-ROLE-07: the same full-screen live voice interview candidates get (lobby, call, summary),
 * on an admin-owned test session, over the admin shell. `?session=` keeps the open test so it can be resumed.
 */
export function PreviewInterview() {
  // Keyed per fresh navigation: arriving from the content preview starts at the lobby, while browser
  // back/forward still restores the preserved screen (Next.js keeps visited pages in <Activity>).
  const { bfcacheId } = useRouter();
  return <TestInterview key={bfcacheId} />;
}

function TestInterview() {
  const role = useRole();
  const router = useRouter();
  const search = useSearchParams();
  const base = `/roles/${encodeURIComponent(role.id)}`;
  const previewHref = `${base}/preview`;
  const [sessionId, setSessionId] = useState<string | null>(() => search.get("session"));
  const [stage, setStage] = useState<"lobby" | "call">("lobby");
  /** A new call component (fresh state) per join. */
  const [callKey, setCallKey] = useState(0);
  /** The open, unfinished test session, for the lobby's resume variant. */
  const [open, setOpen] = useState<PreviewInProgress | null>(null);
  const [report, setReport] = useState<PreviewReport | null>(null);
  const [checking, setChecking] = useState(() => Boolean(search.get("session")));
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const mutationLock = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  const keepSession = useCallback((id: string | null) => {
    setSessionId(id);
    router.replace(id ? `${base}/test?session=${encodeURIComponent(id)}` : `${base}/test`, { scroll: false });
  }, [router, base]);

  // In the lobby, the server says whether `?session=` is still open (resume) or already finished (summary).
  useEffect(() => {
    if (!sessionId || stage !== "lobby" || report) return;
    const controller = new AbortController();
    getPreview(sessionId, controller.signal)
      .then((session) => {
        if (isPreviewInProgress(session)) setOpen(session);
        else setReport(session);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setOpen(null);
        setError(message(failure, "Could not check the test session."));
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [sessionId, stage, report]);

  async function join() {
    if (mutationLock.current || !lifecycle.current) return;
    const signal = lifecycle.current.signal;
    mutationLock.current = true;
    setJoining(true);
    setError(null);
    try {
      // Starts a test session, or resumes the open one (409 session_in_progress).
      const started = await startPreview(role.id, signal);
      if (signal.aborted) return;
      keepSession(started.id);
      setCallKey((key) => key + 1);
      setStage("call");
    } catch (failure) {
      if (!signal.aborted) setError(message(failure, "Could not start the test interview. Please try again."));
    } finally {
      mutationLock.current = false;
      if (!signal.aborted) setJoining(false);
    }
  }

  /** Back to a fresh lobby: no open session. */
  const reset = useCallback(() => {
    keepSession(null);
    setOpen(null);
    setReport(null);
    setError(null);
    setStage("lobby");
  }, [keepSession]);

  const onLeft = useCallback(() => { setError(null); setStage("lobby"); }, []);
  const onCompleted = useCallback((done: PreviewReport) => { setOpen(null); setReport(done); }, []);

  const screen = report ? "summary" : stage === "call" && sessionId ? "call" : checking ? "checking" : "lobby";
  return (
    <CallOverlay focusKey={screen}>
      {screen === "summary" && report ? (
        <CallSummary report={report} roleName={role.title} onStartAnother={reset} previewHref={previewHref} />
      ) : screen === "call" && sessionId ? (
        <TestCall key={callKey} sessionId={sessionId} previewHref={previewHref} onLeft={onLeft} onAbandoned={reset} onCompleted={onCompleted} />
      ) : screen === "checking" ? (
        <CallMessage busy title="Checking the test session…" />
      ) : (
        <Lobby
          roleName={role.title}
          previewHref={previewHref}
          questions={open?.questions.length || role.settings.questionsPerSession || null}
          resuming={!!open}
          archived={role.status === "archived"}
          joining={joining}
          error={error}
          onJoin={() => void join()}
        />
      )}
    </CallOverlay>
  );
}
