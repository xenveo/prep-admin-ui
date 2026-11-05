import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/** The Transcript button, which takes focus back when the drawer closes. */
export const TRANSCRIPT_TOGGLE_ID = "call-transcript-toggle";

function Control({ id, label, icon, pressed, danger, disabled, onClick, ...aria }: {
  id?: string;
  label: string;
  icon: IconName;
  pressed?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  "aria-keyshortcuts"?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      // A disclosure (aria-expanded) or the red Leave button is not a toggle.
      aria-pressed={danger || aria["aria-expanded"] !== undefined ? undefined : !!pressed}
      disabled={disabled}
      onClick={onClick}
      {...aria}
      className={cn(
        "inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "bg-[#B91C1C] text-white hover:bg-[#991B1B] md:px-5"
          : pressed ? "bg-ink text-[#0D1010] hover:bg-ink/90 md:px-4"
            : "border border-line bg-[#1E2322] text-ink hover:bg-[#252B29] md:px-4",
      )}
    >
      <Icon name={icon} className="size-5" />
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
}

/** The call's control bar: pill buttons, icon-only circles below md. */
export function CallControls(p: {
  connected: boolean;
  muted: boolean;
  paused: boolean;
  pausePending: boolean;
  repeatPending: boolean;
  canRepeat: boolean;
  transcriptOpen: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRepeat: () => void;
  onToggleTranscript: () => void;
  onLeave: () => void;
}) {
  return (
    <footer
      role="toolbar"
      aria-label="Call controls"
      className="flex shrink-0 items-center justify-center gap-2.5 px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:gap-3 md:px-6 md:pt-3.5 md:pb-5"
    >
      <Control label={p.muted ? "Unmute" : "Mute"} icon={p.muted ? "micOff" : "mic"} pressed={p.muted} disabled={!p.connected} aria-keyshortcuts="M" onClick={p.onToggleMute} />
      <Control label={p.paused ? "Resume" : "Pause"} icon={p.paused ? "play" : "pause"} pressed={p.paused} disabled={!p.connected || p.pausePending} onClick={p.onTogglePause} />
      <Control label="Repeat question" icon="repeat" disabled={!p.connected || !p.canRepeat || p.repeatPending} onClick={p.onRepeat} />
      <Control id={TRANSCRIPT_TOGGLE_ID} label="Transcript" icon="transcript" pressed={p.transcriptOpen} aria-expanded={p.transcriptOpen} aria-controls="call-transcript" onClick={p.onToggleTranscript} />
      <Control label="Leave" icon="leave" danger onClick={p.onLeave} />
    </footer>
  );
}
