"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BAND_LABEL, bandForScore, parseBand } from "@/lib/bands";
import { cn } from "@/lib/cn";
import type { PreviewAttempt, PreviewReport } from "@/services/preview";
import { callButton } from "./call-parts";
import { INTERVIEWER_NAME } from "./call-prefs";
import { useReducedMotion } from "./use-reduced-motion";

const R = 66;
const C = 2 * Math.PI * R;

/** The report's band label; the sessions API uses the candidate app's ids ("interview-ready", "nearly-ready", ...). */
function bandLabel(report: PreviewReport): string {
  const id = report.band === "interview-ready" ? "ready" : report.band === "nearly-ready" ? "nearly" : report.band;
  return BAND_LABEL[parseBand(id) ?? bandForScore(report.score)];
}

/** 132px session score ring; fills once over 800ms, static under reduced motion. */
function SummaryRing({ score, label }: { score: number; label: string }) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const value = Math.round(Math.max(0, Math.min(100, score)));
  const arc = (C * value) / 100;
  const shown = reduced || mounted ? arc : 0;
  return (
    <svg width="132" height="132" viewBox="0 0 160 160" role="img" aria-label={`Session score ${value}, ${label}`} className="shrink-0">
      <circle cx="80" cy="80" r={R} fill="none" strokeWidth="12" className="stroke-line" />
      <circle
        cx="80"
        cy="80"
        r={R}
        fill="none"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${shown} ${C}`}
        transform="rotate(-90 80 80)"
        className="stroke-primary"
        style={reduced ? undefined : { transition: "stroke-dasharray 800ms ease-out" }}
        opacity={shown > 0 ? 1 : 0}
      />
      <text x="80" y="94" textAnchor="middle" fontSize="44" fontWeight="700" className="fill-ink">{value}</text>
    </svg>
  );
}

type Chip = { label: string; tone: "best" | "plain" | "skipped" };

/** "Attempt 1 · 56", "Attempt 2 · 81 · best": the best is the highest score (the later one on a tie). */
function attemptChips(first: PreviewAttempt, second: PreviewAttempt | null): Chip[] {
  const scores = [first, second].filter((a): a is PreviewAttempt => !!a).map((a) => Math.round(a.feedback.score));
  const best = scores.lastIndexOf(Math.max(...scores));
  const chips: Chip[] = scores.map((s, i) => ({
    label: `Attempt ${i + 1} · ${s}${scores.length > 1 && i === best ? " · best" : ""}`,
    tone: i === best ? "best" : "plain",
  }));
  if (!second) chips.push({ label: "Second try skipped", tone: "skipped" });
  return chips;
}

const CHIP: Record<Chip["tone"], string> = {
  best: "border-primary bg-primary-soft text-primary-text",
  plain: "border-line text-ink-muted",
  skipped: "border-dashed border-line text-ink-muted",
};

/** End-of-test summary: score, band, interviewer's note, per-question attempts, focus areas and next steps. */
export function CallSummary({ report, roleName, onStartAnother, previewHref }: {
  report: PreviewReport;
  roleName: string;
  onStartAnother: () => void;
  previewHref: string;
}) {
  const band = bandLabel(report);
  const focus = report.focus.map((f) => f.text).filter(Boolean);

  return (
    <div className="flex flex-1 justify-center overflow-y-auto overscroll-contain px-4 py-8 md:px-6 md:py-12">
      <div className="flex w-full max-w-[880px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <SummaryRing score={report.score} label={band} />
          <div className="flex min-w-0 flex-1 basis-[280px] flex-col gap-2">
            <span className="text-[13px] leading-5 text-ink-muted">Test complete · {roleName}</span>
            <h1 className="m-0 text-[30px] leading-[38px] font-semibold">{band}</h1>
            {report.bandMessage && (
              <p className="m-0 text-[16px] leading-[26px] text-neutral-text">
                “{report.bandMessage}” <span className="text-ink-muted">· {INTERVIEWER_NAME}</span>
              </p>
            )}
          </div>
        </div>

        <section aria-labelledby="sum-q" className="flex flex-col gap-2.5">
          <h2 id="sum-q" className="m-0 text-[16px] font-semibold">Question by question</h2>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {report.results.map((r, i) => (
              <li key={r.question.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-[#161A19] px-[18px] py-3.5">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-soft text-[13px] font-bold">
                  {r.question.index || i + 1}
                </span>
                <span className="min-w-0 flex-1 basis-[240px] text-[15px] leading-[22px]">
                  <span className="sr-only">Question {r.question.index || i + 1}: </span>
                  {r.question.text}
                </span>
                <span className="flex flex-wrap gap-2">
                  {attemptChips(r.first, r.second).map((c) => (
                    <span key={c.label} className={cn("inline-flex min-h-[30px] items-center rounded-full border px-2.5 text-[13px] font-semibold", CHIP[c.tone])}>
                      {c.label}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {focus.length > 0 && (
          <section aria-labelledby="sum-f" className="flex flex-col gap-2.5 rounded-xl border border-line bg-[#161A19] p-[18px]">
            <h2 id="sum-f" className="m-0 text-[16px] font-semibold text-improve">Focus areas for next time</h2>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {focus.map((t, i) => (
                <li key={i} className="text-[15px] leading-[23px] text-neutral-text">{i + 1}. {t}</li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onStartAnother} className={cn(callButton.primary, "px-6 font-bold")}>Start another test</button>
          <Link href={previewHref} className={callButton.secondary}>Back to content preview</Link>
        </div>
      </div>
    </div>
  );
}
