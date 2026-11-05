"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api/client"
import { connectPreviewLive } from "@/services/preview"
import { getCallPrefs } from "./call-prefs"
import { startLevelMeter, type LevelMeter } from "./level-meter"

/**
 * idle: not connected yet. connecting: mic, offer and SDP exchange in progress. live: audio flowing.
 * lost: needs a reconnect (see `problem`; `autoReconnecting` while one is about to run by itself). ended: hung up by this tab.
 */
export type LiveStatus = "idle" | "connecting" | "live" | "lost" | "ended"
export type LiveProblemKind = "mic_denied" | "mic_unavailable" | "unsupported" | "ai_unavailable" | "not_available" | "connection_lost" | "unknown"
export type LiveProblem = { kind: LiveProblemKind; message: string }
export type Caption = {
  id: number
  speaker: "interviewer" | "candidate"
  text: string
  /** Wall-clock ms of the caption's first and latest words. */
  at: number
  updatedAt: number
  /** An interviewer line the candidate talked over. */
  interrupted?: boolean
}

/** Wait at most this long for ICE gathering before sending the offer as it is. */
const ICE_GATHER_CAP_MS = 3000
/** Wait at most this long for `session.closed` after asking the provider to close. */
const CLOSE_CAP_MS = 2000
/** A "disconnected" peer often recovers on its own; only then is a reconnect offered. */
const DISCONNECT_GRACE_MS = 3000
/** After an unplanned drop of a working call, reconnect once by itself after this long. */
const AUTO_RECONNECT_MS = 1500
/** Captions kept for the transcript, across reconnects. */
const MAX_CAPTIONS = 300
/** The interviewer counts as speaking this long after its last audio or transcript. */
const SPEAKING_HOLD_MS = 700
/** The candidate counts as speaking this long after their last mic speech or transcript. */
const CANDIDATE_HOLD_MS = 700
const CANDIDATE_CAPTION_HOLD_MS = 1000
/** "You're muted" stays up this long after the last speech heard on the muted mic. */
const MUTED_SPEECH_HOLD_MS = 2500
/** Background noise: a 5 s noise floor above NOISY_DB shows the hint, below QUIET_DB hides it. */
const NOISY_DB = -45
const QUIET_DB = -48
const POLL_MS = 150

const MESSAGES: Record<Exclude<LiveProblemKind, "unknown">, string> = {
  mic_denied: "PrepPilot can't use your microphone. Allow microphone access in your browser, then reconnect.",
  mic_unavailable: "We couldn't find a microphone. Connect one, then reconnect.",
  unsupported: "This browser can't run a live interview. Use a recent version of Chrome, Edge, Firefox or Safari.",
  ai_unavailable: "The live interviewer is unavailable right now. Your saved answers are safe. Try reconnecting in a moment.",
  not_available: "This interview can't be joined right now.",
  connection_lost: "The connection to your interviewer was lost. Your scored answers are saved. Reconnect to continue.",
}

type Connection = {
  pc: RTCPeerConnection
  dc: RTCDataChannel
  mic: MediaStream
  /**
   * A clone of the mic that stays enabled and is never sent. It is metered so speech and background
   * noise are noticed while the sent track is muted or paused.
   */
  monitor: MediaStream
  abort: AbortController
  micMeter: LevelMeter | null
  remoteMeter: LevelMeter | null
  /** Set once this tab hangs up, so the resulting close is not reported as a lost connection. */
  intentional: boolean
  /** The call was live at least once, so a drop is reconnected automatically (once). */
  reachedLive: boolean
  /** Resolves when the provider confirms `session.closed` or the data channel closes. */
  closed: Promise<void>
  markClosed: () => void
  disconnectTimer: number
}

type Signals = { candidateSpeaking: boolean; mutedSpeech: boolean; noisy: boolean }
const QUIET: Signals = { candidateSpeaking: false, mutedSpeech: false, noisy: false }

function iceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", check); resolve() }
    const check = () => { if (pc.iceGatheringState === "complete") done() }
    const timer = setTimeout(done, ICE_GATHER_CAP_MS)
    pc.addEventListener("icegatheringstatechange", check)
  })
}

function stopTracks(c: Connection) {
  c.mic.getTracks().forEach((t) => t.stop())
  c.monitor.getTracks().forEach((t) => t.stop())
}

/** Releases everything a connection holds. Safe to call more than once. */
function release(c: Connection) {
  clearTimeout(c.disconnectTimer)
  c.abort.abort()
  stopTracks(c)
  c.micMeter?.close(); c.micMeter = null
  c.remoteMeter?.close(); c.remoteMeter = null
  c.dc.onmessage = null
  if (c.dc.readyState !== "closed") c.dc.close()
  c.pc.ontrack = null
  c.pc.onconnectionstatechange = null
  if (c.pc.connectionState !== "closed") c.pc.close()
  c.markClosed()
}

function sendEvent(c: Connection, type: "session.close" | "session.input_audio.mute" | "session.input_audio.unmute") {
  if (c.dc.readyState === "open") c.dc.send(JSON.stringify({ type }))
}

/** Plays through the speaker chosen in the lobby when the browser supports choosing one. */
function applySpeaker(el: HTMLAudioElement | null) {
  const speakerId = getCallPrefs().speakerId
  if (!el || !speakerId || typeof el.setSinkId !== "function") return
  void el.setSinkId(speakerId).catch(() => { /* the device may be gone; the default output plays */ })
}

/**
 * Realtime voice interview over WebRTC (OpenAI Live). The server creates the live session from our
 * offer and listens on a sideband; this tab only plays the interviewer, streams the mic, shows
 * captions and can mute, pause or hang up. The microphone is released and the peer closed on hang-up,
 * on a lost connection and on unmount. Nothing is recorded.
 */
export function useLiveInterview(sessionId: string | undefined) {
  const [status, setStatus] = useState<LiveStatus>("idle")
  const [problem, setProblem] = useState<LiveProblem | null>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [muted, setMutedState] = useState(false)
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false)
  const [signals, setSignals] = useState<Signals>(QUIET)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [autoReconnecting, setAutoReconnecting] = useState(false)
  /** Wall-clock ms of the first time this page's call went live. */
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const conn = useRef<Connection | null>(null)
  const generation = useRef(0)
  const captionSeq = useRef(0)
  const lastSpeaker = useRef<Caption["speaker"] | null>(null)
  const lastInterviewerAt = useRef(0)
  /** End of the interviewer's latest words on the provider's audio clock, to tell a barge-in from a reply. */
  const interviewerEndMs = useRef<number | null>(null)
  const lastCandidateCaptionAt = useRef(0)
  const lastMicSpeechAt = useRef(0)
  const lastMutedSpeechAt = useRef(0)
  const mutedRef = useRef(false)
  const pausedRef = useRef(false)
  const noisyRef = useRef(false)
  const autoRetryUsed = useRef(false)
  const reconnectTimer = useRef(0)
  const connectRef = useRef<() => Promise<void>>(async () => {})

  const interviewerTalkingNow = useCallback(() => {
    const c = conn.current
    if (c && (c.remoteMeter?.level() ?? 0) > 0) lastInterviewerAt.current = performance.now()
    return !!c && performance.now() - lastInterviewerAt.current < SPEAKING_HOLD_MS
  }, [])

  const appendCaption = useCallback((speaker: Caption["speaker"], delta: string, startMs: number | null, endMs: number | null) => {
    if (!delta) return
    const fresh = lastSpeaker.current !== speaker
    lastSpeaker.current = speaker
    const id = fresh ? ++captionSeq.current : captionSeq.current
    const now = Date.now()
    let interrupts = false
    if (speaker === "interviewer") {
      if (endMs !== null) interviewerEndMs.current = endMs
      else if (fresh) interviewerEndMs.current = null
    } else {
      lastCandidateCaptionAt.current = performance.now()
      // The candidate started talking before the interviewer's line ended: they talked over it.
      if (fresh) interrupts = startMs !== null && interviewerEndMs.current !== null ? startMs < interviewerEndMs.current : interviewerTalkingNow()
    }
    setCaptions((prev) => {
      const last = prev[prev.length - 1]
      if (!fresh && last?.id === id) return [...prev.slice(0, -1), { ...last, text: last.text + delta, updatedAt: now }]
      const base = interrupts && last?.speaker === "interviewer" ? [...prev.slice(0, -1), { ...last, interrupted: true }] : prev
      return [...base, { id, speaker, text: delta, at: now, updatedAt: now }].slice(-MAX_CAPTIONS)
    })
  }, [interviewerTalkingNow])

  const markLive = useCallback((c: Connection) => {
    if (conn.current !== c) return
    c.reachedLive = true
    autoRetryUsed.current = false
    setStatus("live")
    setCallStartedAt((t) => t ?? Date.now())
  }, [])

  /** An unplanned end: release the connection and reconnect once by itself, or offer a reconnect. */
  const lose = useCallback((c: Connection, next: LiveProblem) => {
    if (conn.current !== c || c.intentional) return
    conn.current = null
    release(c)
    setStatus("lost")
    setProblem(next)
    setInterviewerSpeaking(false)
    if (c.reachedLive && !autoRetryUsed.current) {
      autoRetryUsed.current = true
      setAutoReconnecting(true)
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = window.setTimeout(() => { void connectRef.current() }, AUTO_RECONNECT_MS)
    }
  }, [])

  const onData = useCallback((c: Connection, raw: unknown) => {
    if (typeof raw !== "string") return
    let event: { type?: unknown; delta?: unknown; reason?: unknown; start_ms?: unknown; end_ms?: unknown }
    try { event = JSON.parse(raw) as typeof event } catch { return }
    const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
    switch (event.type) {
      case "session.started":
        markLive(c)
        return
      case "session.closed":
        c.markClosed()
        if (!c.intentional) lose(c, { kind: "connection_lost", message: MESSAGES.connection_lost })
        return
      case "session.input_transcript.delta":
        if (typeof event.delta === "string") appendCaption("candidate", event.delta, ms(event.start_ms), ms(event.end_ms))
        return
      case "session.output_transcript.delta":
        if (typeof event.delta === "string") { lastInterviewerAt.current = performance.now(); appendCaption("interviewer", event.delta, ms(event.start_ms), ms(event.end_ms)) }
        return
      case "session.input_audio.muted":
        mutedRef.current = true
        setMutedState(true)
        return
      case "session.input_audio.unmuted":
        mutedRef.current = false
        setMutedState(false)
        return
      default:
        // `error` frames are provider warnings; a fatal one also closes the session.
        return
    }
  }, [appendCaption, lose, markLive])

  const connect = useCallback(async () => {
    if (!sessionId) return
    const run = ++generation.current
    const stale = () => run !== generation.current
    clearTimeout(reconnectTimer.current)
    setAutoReconnecting(false)
    const previous = conn.current
    if (previous) { previous.intentional = true; conn.current = null; release(previous) }
    setStatus("connecting"); setProblem(null); setMutedState(false); setAudioBlocked(false)
    // A pause outlives a reconnect; the flow resumes it explicitly.
    mutedRef.current = false
    lastSpeaker.current = null

    if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("lost"); setProblem({ kind: "unsupported", message: MESSAGES.unsupported }); return
    }
    const micId = getCallPrefs().micId
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { ...(micId ? { deviceId: { ideal: micId } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (e) {
      if (stale()) return
      const name = e instanceof DOMException ? e.name : ""
      const kind = name === "NotAllowedError" || name === "SecurityError" ? "mic_denied" : "mic_unavailable"
      setStatus("lost"); setProblem({ kind, message: MESSAGES[kind] }); return
    }
    if (stale()) { mic.getTracks().forEach((t) => t.stop()); return }

    const pc = new RTCPeerConnection()
    let markClosed = () => {}
    const closed = new Promise<void>((resolve) => { markClosed = resolve })
    // Create the data channel before the offer so it is negotiated in it.
    const dc = pc.createDataChannel("oai-events")
    const monitor = new MediaStream(mic.getAudioTracks().map((t) => t.clone()))
    mic.getAudioTracks().forEach((t) => { t.enabled = !pausedRef.current })
    const c: Connection = { pc, dc, mic, monitor, abort: new AbortController(), micMeter: null, remoteMeter: null, intentional: false, reachedLive: false, closed, markClosed, disconnectTimer: 0 }
    conn.current = c
    applySpeaker(audioRef.current)

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track])
      const el = audioRef.current
      if (el) {
        el.srcObject = stream
        void el.play().then(() => setAudioBlocked(false)).catch(() => { if (conn.current === c) setAudioBlocked(true) })
      }
      void startLevelMeter(stream).then((m) => { if (conn.current === c && !c.remoteMeter) c.remoteMeter = m; else m?.close() })
    }
    pc.onconnectionstatechange = () => {
      if (conn.current !== c) return
      const state = pc.connectionState
      clearTimeout(c.disconnectTimer)
      if (state === "connected") markLive(c)
      else if (state === "failed") lose(c, { kind: "connection_lost", message: MESSAGES.connection_lost })
      else if (state === "disconnected") c.disconnectTimer = window.setTimeout(() => lose(c, { kind: "connection_lost", message: MESSAGES.connection_lost }), DISCONNECT_GRACE_MS)
    }
    dc.onmessage = (e: MessageEvent) => onData(c, e.data)
    dc.onclose = () => { c.markClosed(); if (conn.current === c && !c.intentional) lose(c, { kind: "connection_lost", message: MESSAGES.connection_lost }) }
    mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic))

    try {
      await pc.setLocalDescription(await pc.createOffer())
      await iceGatheringComplete(pc)
      if (stale()) return
      const answer = await connectPreviewLive(sessionId, pc.localDescription!.sdp, c.abort.signal)
      if (stale()) return
      // The HTTP call started the session; the browser does not send session.start.
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp })
    } catch (e) {
      if (stale() || conn.current !== c) return
      c.intentional = true
      conn.current = null
      release(c)
      setStatus("lost")
      if (e instanceof ApiError && e.status === 503) setProblem({ kind: "ai_unavailable", message: MESSAGES.ai_unavailable })
      else if (e instanceof ApiError && e.status === 409) setProblem({ kind: "not_available", message: e.message || MESSAGES.not_available })
      else if (e instanceof ApiError && e.status < 500 && e.message) setProblem({ kind: "unknown", message: e.message })
      else setProblem({ kind: "connection_lost", message: "We couldn't reach your interviewer. Check your connection, then reconnect." })
      return
    }
    void startLevelMeter(monitor).then((m) => { if (conn.current === c && !c.micMeter) c.micMeter = m; else m?.close() })
  }, [sessionId, onData, lose, markLive])

  useEffect(() => { connectRef.current = connect }, [connect])

  /** Hangs up cleanly: asks the provider to close, waits briefly for confirmation, then releases everything. */
  const hangUp = useCallback(async () => {
    generation.current++
    clearTimeout(reconnectTimer.current)
    setAutoReconnecting(false)
    const c = conn.current
    conn.current = null
    setStatus("ended")
    setInterviewerSpeaking(false)
    if (!c) return
    c.intentional = true
    stopTracks(c)
    if (c.dc.readyState === "open") {
      sendEvent(c, "session.close")
      await Promise.race([c.closed, new Promise((resolve) => setTimeout(resolve, CLOSE_CAP_MS))])
    }
    release(c)
  }, [])

  /** The server reported (`live.ended`) that the live session ended. */
  const serverEnded = useCallback((reason: string) => {
    const c = conn.current
    if (!c || c.intentional) return
    lose(c, { kind: "connection_lost", message: reason === "expired" ? "The live session reached its time limit. Reconnect to continue where you left off." : MESSAGES.connection_lost })
  }, [lose])

  /** Sends audio only while neither muted nor paused. Disabling the track keeps audio in the browser at once. */
  const applyTrack = useCallback(() => {
    const enabled = !mutedRef.current && !pausedRef.current
    conn.current?.mic.getAudioTracks().forEach((t) => { t.enabled = enabled })
  }, [])

  const setMuted = useCallback((next: boolean) => {
    mutedRef.current = next
    setMutedState(next)
    applyTrack()
    const c = conn.current
    if (c) sendEvent(c, next ? "session.input_audio.mute" : "session.input_audio.unmute")
  }, [applyTrack])

  /** While paused the mic sends silence; the server tells the interviewer to wait. */
  const setPaused = useCallback((next: boolean) => {
    pausedRef.current = next
    applyTrack()
  }, [applyTrack])

  const resumeAudio = useCallback(() => {
    void audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
  }, [])

  /** Live microphone speech level, 0..1, as sent to the interviewer. 0 while muted, paused or disconnected. */
  const micLevel = useCallback(() => {
    const c = conn.current
    if (!c || !c.mic.getAudioTracks().some((t) => t.enabled)) return 0
    return c.micMeter?.level() ?? 0
  }, [])

  /** The interviewer's voice level, 0..1. */
  const remoteLevel = useCallback(() => conn.current?.remoteMeter?.level() ?? 0, [])

  /** True while the interviewer is talking, from its audio level and its transcript. */
  const isInterviewerSpeaking = interviewerTalkingNow

  /** A live connection exists (connecting or connected). */
  const isConnected = useCallback(() => !!conn.current, [])

  useEffect(() => {
    if (status !== "live") return
    const timer = window.setInterval(() => {
      setInterviewerSpeaking(interviewerTalkingNow())
      const c = conn.current
      const now = performance.now()
      const heard = (c?.micMeter?.level() ?? 0) > 0
      if (heard && mutedRef.current && !pausedRef.current) lastMutedSpeechAt.current = now
      else if (heard && !mutedRef.current && !pausedRef.current) lastMicSpeechAt.current = now
      const floor = c?.micMeter?.noiseFloorDb() ?? null
      noisyRef.current = floor !== null && (noisyRef.current ? floor > QUIET_DB : floor > NOISY_DB)
      const next: Signals = {
        candidateSpeaking: now - lastMicSpeechAt.current < CANDIDATE_HOLD_MS || now - lastCandidateCaptionAt.current < CANDIDATE_CAPTION_HOLD_MS,
        mutedSpeech: mutedRef.current && now - lastMutedSpeechAt.current < MUTED_SPEECH_HOLD_MS,
        noisy: noisyRef.current,
      }
      setSignals((prev) => (prev.candidateSpeaking === next.candidateSpeaking && prev.mutedSpeech === next.mutedSpeech && prev.noisy === next.noisy ? prev : next))
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [status, interviewerTalkingNow])

  // Leaving the page (navigation, reload, tab close) hangs up best-effort and always releases the mic.
  useEffect(() => {
    const leave = () => {
      generation.current++
      clearTimeout(reconnectTimer.current)
      const c = conn.current
      conn.current = null
      if (!c) return false
      c.intentional = true
      stopTracks(c)
      sendEvent(c, "session.close")
      // Give the close message a moment to leave before the peer goes away.
      window.setTimeout(() => release(c), 300)
      return true
    }
    window.addEventListener("pagehide", leave)
    return () => {
      window.removeEventListener("pagehide", leave)
      // Next.js keeps a page it navigates away from hidden (Activity) with its state: show the call as hung up
      // when it comes back (browser back/forward), so it offers a reconnect instead of a dead "live" call.
      if (leave()) { setStatus("ended"); setAutoReconnecting(false); setInterviewerSpeaking(false) }
    }
  }, [])

  const live = status === "live"
  return {
    status, problem, captions, muted, audioBlocked, audioRef, callStartedAt,
    /** Lost, with an automatic reconnect about to run. */
    autoReconnecting: status === "lost" && autoReconnecting,
    interviewerSpeaking: live && interviewerSpeaking,
    candidateSpeaking: live && signals.candidateSpeaking,
    /** The candidate is talking while muted, so the interviewer can't hear them. */
    mutedSpeech: live && muted && signals.mutedSpeech,
    /** Steady background noise on the mic. */
    noisy: live && signals.noisy,
    connect, hangUp, serverEnded, setMuted, setPaused, resumeAudio, micLevel, remoteLevel, isInterviewerSpeaking, isConnected,
  }
}
