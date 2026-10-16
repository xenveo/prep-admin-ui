"use client";

import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** System / light / dark. Expanded: a segmented radio group. Collapsed: one button that cycles. */
export function ThemeToggle({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  const theme = useTheme();

  if (collapsed) {
    const next = OPTIONS[(OPTIONS.findIndex((o) => o.value === theme) + 1) % OPTIONS.length];
    const current = OPTIONS.find((o) => o.value === theme)!;
    return (
      <Tooltip content={`Theme: ${current.label.toLowerCase()}`} side="right">
        <button
          type="button"
          onClick={() => setTheme(next.value)}
          aria-label={`Theme: ${current.label.toLowerCase()}. Switch to ${next.label.toLowerCase()}`}
          className={cn(
            "focus-inset inline-flex size-10 items-center justify-center rounded-lg text-ink-muted hover:bg-row-hover hover:text-ink",
            className,
          )}
        >
          <Icon name={theme === "dark" ? "moon" : "sun"} size={18} />
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("flex gap-0.5 rounded-[9px] border border-line bg-bg p-[3px]", className)}
    >
      {OPTIONS.map((o) => {
        const selected = o.value === theme;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(o.value)}
            className={cn(
              "focus-inset flex-1 rounded-sm py-1.5 text-xs font-semibold leading-4",
              selected ? "bg-selected text-ink" : "text-ink-faint hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
