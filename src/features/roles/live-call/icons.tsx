import type { SVGProps } from "react";

/** Line icons from the call design (24px grid, 2px stroke, currentColor). */
const PATHS = {
  mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  micOff: "M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.3 5.5M12 18v3",
  pause: "M8 5v14M16 5v14",
  play: "M7 4.5v15l12-7.5z",
  repeat: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4",
  transcript: "M4 5h16v11H8l-4 4zM8 9h8M8 12h5",
  leave: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  noise: "M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6",
  timer: "M12 5a8 8 0 1 1 0 16a8 8 0 0 1 0-16zM12 9v4",
  speaker: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  check: "M5 12.5l4.5 4.5L19 7.5",
  external: "M7 17L17 7M8 7h9v9",
  logo: "M3 12l7-7 2 4 4-2-2 4 4 2-7 7-2-4-4 2 2-4z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, strokeWidth = 2, ...props }: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d={PATHS[name]} />
    </svg>
  );
}
