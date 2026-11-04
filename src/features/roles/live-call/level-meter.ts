/** Live microphone level for the interview room, measured on the audio thread. Nothing is recorded or stored. */

/** Level frames are this long. */
const FRAME_MS = 20;
const ENTER_DB = 10;
const HYSTERESIS_DB = 3;
const FLOOR_PERCENTILE = 0.1;
/** Digital silence reports -Infinity; treat anything quieter as this level. */
const MIN_DB = -100;
const SPEECH_LEVEL_DB = -50;

/** Frames of history used for the live noise floor (about 5 s at 20 ms). */
const LIVE_FLOOR_FRAMES = 250;
/** Frames averaged into one live reading (about 100 ms), so single clicks do not register. */
const LIVE_WINDOW_FRAMES = 5;
/** dB above the speech threshold that reads as full level. */
const LIVE_SPAN_DB = 30;

const clampDb = (db: number) => (Number.isFinite(db) ? Math.max(db, MIN_DB) : MIN_DB);

/** The recent noise floor in dBFS: a low percentile of the last ~5 s, so speech does not lift it. */
function noiseFloor(levelsDb: ArrayLike<number>): number {
  const n = levelsDb.length;
  const recent: number[] = [];
  for (let i = Math.max(0, n - LIVE_FLOOR_FRAMES); i < n; i++) recent.push(clampDb(levelsDb[i]));
  recent.sort((a, b) => a - b);
  return recent[Math.floor((recent.length - 1) * FLOOR_PERCENTILE)];
}

/**
 * Live speech level for a meter: speech starts ENTER_DB above the adaptive noise floor (and above
 * SPEECH_LEVEL_DB) and ends HYSTERESIS_DB lower. Returns 0 for silence or room noise, otherwise 0..1 above the threshold.
 */
function liveSpeechLevel(levelsDb: ArrayLike<number>, wasSpeaking: boolean): { level: number; speaking: boolean } {
  const n = levelsDb.length;
  if (n < LIVE_WINDOW_FRAMES) return { level: 0, speaking: false };
  const floor = noiseFloor(levelsDb);
  let sum = 0;
  for (let i = n - LIVE_WINDOW_FRAMES; i < n; i++) sum += clampDb(levelsDb[i]);
  const db = sum / LIVE_WINDOW_FRAMES;
  // Speech dips between words, so a level that never rises ENTER_DB above the recent floor is steady noise (fans, hum).
  const enter = Math.max(floor + ENTER_DB, SPEECH_LEVEL_DB);
  const speaking = db >= enter - (wasSpeaking ? HYSTERESIS_DB : 0);
  return { level: speaking ? Math.max(0.08, Math.min(1, (db - enter + HYSTERESIS_DB) / LIVE_SPAN_DB)) : 0, speaking };
}

// Runs on the audio thread, so frames stay evenly spaced when the tab is throttled.
const METER_WORKLET_URL = "/worklets/level-meter.js";

export type LevelMeter = {
  /** Live speech level, 0..1. 0 for silence and room noise. */
  level: () => number;
  /** Steady background level in dBFS over the last ~5 s; null until that much audio was metered. */
  noiseFloorDb: () => number | null;
  close: () => void;
};

/** Meters a stream's level. Null when Web Audio is unavailable. Closing does not stop the stream's tracks. */
export async function startLevelMeter(stream: MediaStream): Promise<LevelMeter | null> {
  if (typeof AudioContext === "undefined" || typeof AudioWorkletNode === "undefined") return null;
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(METER_WORKLET_URL);
    const frameSamples = Math.round((context.sampleRate * FRAME_MS) / 1000);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "pp-level-meter", { numberOfInputs: 1, numberOfOutputs: 0, processorOptions: { frameSamples } });
    // Only the recent window is kept: enough for the adaptive noise floor.
    const levels: number[] = [];
    node.port.onmessage = (e: MessageEvent<number>) => { levels.push(e.data); if (levels.length > LIVE_FLOOR_FRAMES * 2) levels.splice(0, levels.length - LIVE_FLOOR_FRAMES); };
    source.connect(node);
    await context.resume();
    let speaking = false;
    return {
      level: () => { const reading = liveSpeechLevel(levels, speaking); speaking = reading.speaking; return reading.level; },
      noiseFloorDb: () => (levels.length < LIVE_FLOOR_FRAMES ? null : noiseFloor(levels)),
      close: () => { node.port.onmessage = null; source.disconnect(); void context.close().catch(() => {}); },
    };
  } catch {
    void context.close().catch(() => {});
    return null;
  }
}
