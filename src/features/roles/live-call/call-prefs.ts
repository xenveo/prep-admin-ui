/** The live interviewer's display name, shown in the lobby, the call and the summary. */
export const INTERVIEWER_NAME = "Maya";

export type CaptionSize = "s" | "m" | "l";
export type CallPrefs = { micId: string | null; speakerId: string | null; captionSize: CaptionSize };

const KEY = "pp.callPrefs";
const DEFAULTS: CallPrefs = { micId: null, speakerId: null, captionSize: "m" };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Access can throw when storage is disabled (privacy settings, sandboxed frames).
    return null;
  }
}

const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Saved call preferences; defaults on the server, with nothing saved, or when the saved value is unreadable. */
export function getCallPrefs(): CallPrefs {
  const raw = storage()?.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return { ...DEFAULTS };
    const o = v as Record<string, unknown>;
    return {
      micId: idOrNull(o.micId),
      speakerId: idOrNull(o.speakerId),
      captionSize: o.captionSize === "s" || o.captionSize === "m" || o.captionSize === "l" ? o.captionSize : DEFAULTS.captionSize,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Merges `patch` into the saved preferences. A no-op on the server or when storage is unavailable. */
export function setCallPrefs(patch: Partial<CallPrefs>): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ ...getCallPrefs(), ...patch }));
  } catch {
    // Quota exceeded or storage disabled: preferences are a nicety, so ignore.
  }
}
