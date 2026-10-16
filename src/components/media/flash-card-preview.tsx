"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Side = "front" | "back";

/**
 * Candidate-app flash card, flippable by click / Enter / Space.
 * - "panel": the role editor's Cards-tab preview (centred question, full answer guidance on the back).
 * - "grid": the Preview tab's card (position in the top row, strong points + tip on the back).
 * Controlled when `onSideChange` is passed; otherwise `side` is the starting side and the card flips itself.
 */
export function FlashCardPreview({
  side,
  onSideChange,
  variant = "panel",
  category,
  question,
  strong,
  tip,
  mistakes,
  outline,
  index,
  total,
  className,
}: {
  side: Side;
  /** Makes the card controlled: called with the other side on click. */
  onSideChange?: (side: Side) => void;
  variant?: "panel" | "grid";
  category: string;
  question: string;
  strong: string[];
  tip: string;
  mistakes: string[];
  /** Sample answer outline; shown on the panel back only when set. */
  outline?: string | null;
  /** 1-based position of the card. */
  index?: number;
  total?: number;
  className?: string;
}) {
  const [ownSide, setOwnSide] = useState<Side>(side);
  const [prevSide, setPrevSide] = useState<Side>(side);
  if (side !== prevSide) {
    setPrevSide(side);
    setOwnSide(side);
  }
  const shown = onSideChange ? side : ownSide;
  const back = shown === "back";
  const flip = () => {
    const next: Side = back ? "front" : "back";
    if (onSideChange) onSideChange(next);
    else setOwnSide(next);
  };
  const hasPosition = index != null && total != null;
  const points = strong.filter((s) => s.trim());
  const pitfalls = mistakes.filter((s) => s.trim());
  const tipText = tip.trim();

  const pill = (
    <span className="self-start rounded-full bg-neutral-soft px-[9px] py-1 text-[11px] leading-[14px] font-semibold text-neutral-text">
      {category}
    </span>
  );
  const tipBox = tipText ? (
    <span className="block rounded-lg bg-primary-tint px-2.5 py-2 text-ink-soft">
      <strong className="font-bold text-primary-text">Tip: </strong>
      {tipText}
    </span>
  ) : null;
  const srSide = <span className="sr-only">{back ? "Back of card, answer guidance. " : "Front of card. "}</span>;

  if (variant === "grid") {
    return (
      <button
        type="button"
        aria-pressed={back}
        onClick={flip}
        className={cn(
          "focus-inset flex min-h-60 w-full cursor-pointer flex-col gap-3 rounded-panel border p-[18px] text-left text-ink transition-colors duration-100 hover:border-neutral-line",
          back ? "border-primary-soft bg-surface-sunken" : "border-line bg-surface",
          className,
        )}
      >
        {srSide}
        <span className="flex items-center justify-between gap-2">
          {pill}
          {hasPosition ? (
            <span className="font-mono text-[11px] text-ink-faint">
              <span className="sr-only">Card </span>
              {index} / {total}
            </span>
          ) : null}
        </span>
        {back ? (
          <span className="flex flex-1 flex-col gap-2 text-[13px] leading-[1.45]">
            {points.map((p, i) => (
              <Bullet key={i} tone="strong" offset="mt-[7px]">
                {p}
              </Bullet>
            ))}
            {tipBox}
          </span>
        ) : (
          <span className="flex flex-1 items-center text-[17px] leading-[1.35] font-semibold tracking-[-0.01em] text-pretty">
            {question}
          </span>
        )}
        <span className="text-xs text-ink-faint">{back ? "Click to flip back" : "Click to see answer guidance"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={back}
      onClick={flip}
      className={cn(
        "focus-inset flex min-h-[340px] w-full max-w-[380px] cursor-pointer flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 text-left text-ink transition-colors duration-100 hover:border-neutral-line",
        className,
      )}
    >
      {srSide}
      {pill}
      {back ? (
        <span className="flex flex-1 flex-col gap-3 text-[13px] leading-normal">
          <span className="text-ink-muted">{question}</span>
          {points.length > 0 ? (
            <>
              <span className="text-xs font-bold text-primary-text">
                <span aria-hidden="true">✓ </span>What a strong answer covers
              </span>
              {points.map((p, i) => (
                <Bullet key={i} tone="strong" offset="mt-2">
                  {p}
                </Bullet>
              ))}
            </>
          ) : null}
          {outline?.trim() ? (
            <>
              <span className="text-xs font-bold text-ink">Sample outline</span>
              <span className="whitespace-pre-line text-ink-soft">{outline.trim()}</span>
            </>
          ) : null}
          {tipBox}
          {pitfalls.length > 0 ? (
            <>
              <span className="text-xs font-bold text-improve-text">
                <span aria-hidden="true">! </span>Common mistakes
              </span>
              {pitfalls.map((m, i) => (
                <Bullet key={i} tone="mistake" offset="mt-2">
                  {m}
                </Bullet>
              ))}
            </>
          ) : null}
        </span>
      ) : (
        <span className="flex flex-1 items-center justify-center text-center">
          <span className="text-xl leading-[1.35] font-semibold tracking-[-0.015em] text-balance">{question}</span>
        </span>
      )}
      <span className="text-center text-xs text-ink-faint">
        Click to flip{hasPosition ? ` · card ${index} of ${total}` : ""}
      </span>
    </button>
  );
}

function Bullet({ tone, offset, children }: { tone: "strong" | "mistake"; offset: string; children: string }) {
  return (
    <span className="flex gap-2">
      <span
        aria-hidden="true"
        className={cn("size-1 shrink-0 rounded-full", offset, tone === "strong" ? "bg-primary" : "bg-improve")}
      />
      <span className="min-w-0">{children}</span>
    </span>
  );
}
