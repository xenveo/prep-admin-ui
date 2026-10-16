"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { WeightBar, weightsValid } from "@/components/ui/weight-bar";
import { cn } from "@/lib/cn";
import { formatDuration, parseDuration } from "@/lib/format";
import { emitRoleChanged } from "@/lib/role-events";
import type { DimensionWeights, SessionWeights } from "@/lib/types";
import { updateRole } from "@/services/roles";
import { useRole } from "./role-context";

const SESSION_PARTS = [
  { id: "firstTry", label: "First try" },
  { id: "secondTry", label: "Second try" },
  { id: "learning", label: "Learning" },
];
const DIMENSION_PARTS = [
  { id: "content", label: "Content" },
  { id: "structure", label: "Structure" },
  { id: "delivery", label: "Delivery" },
  { id: "relevance", label: "Relevance" },
];
const MAX_PER_SESSION = 20;

/** Role editor fields use 14px labels with an 8px gap (the shared Field defaults to 13px / 6px). */
const FIELD = "gap-2! [&>label]:text-sm";
const INPUT = "h-10!";

function Section({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-panel border border-line bg-surface p-6", className)}>
      <h2 className="m-0 text-[17px] leading-[23px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const role = useRole();
  const toast = useToast();
  const s = role.settings;
  const readOnly = role.status === "archived";
  const [perSession, setPerSession] = useState(String(s.questionsPerSession));
  const [order, setOrder] = useState(s.questionOrder);
  const [guide, setGuide] = useState(formatDuration(s.answerGuideSeconds));
  const [requireCards, setRequireCards] = useState(s.requireAllCards);
  const [maxSessions, setMaxSessions] = useState(s.maxSessionsPerCandidate === null ? "" : String(s.maxSessionsPerCandidate));
  const [sessionW, setSessionW] = useState<Record<string, number>>({ ...s.sessionWeights });
  const [dimW, setDimW] = useState<Record<string, number>>({ ...s.dimensionWeights });
  const saveLock = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const snapshot = JSON.stringify({ perSession, order, guide, requireCards, maxSessions, sessionW, dimW });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // Helper names the bank size; validation stays 1–20 so a small draft bank never blocks saving.
  const bank = role.questionCount;
  const perSessionN = Number(perSession);
  const perSessionError =
    perSession.trim() === "" || !Number.isInteger(perSessionN) || perSessionN < 1 || perSessionN > MAX_PER_SESSION
      ? `Enter a whole number from 1 to ${MAX_PER_SESSION}`
      : undefined;
  const guideSeconds = parseDuration(guide);
  const guideError = !/^\d+:[0-5]\d$/.test(guide.trim()) || (guideSeconds < 15 || guideSeconds > 600) ? "Use 0:15 to 10:00" : undefined;
  const maxN = Number(maxSessions);
  const maxError =
    maxSessions.trim() !== "" && (!Number.isInteger(maxN) || maxN < 1 || maxN > 100) ? "Enter 1 to 100, or leave blank for no limit" : undefined;
  const weightsError = !weightsValid(sessionW)
    ? "Session score weights must add up to 100%"
    : !weightsValid(dimW)
      ? "Answer score weights must add up to 100%"
      : undefined;
  const blockedReason = perSessionError ?? guideError ?? maxError ?? weightsError;

  async function submit() {
    if (saveLock.current || blockedReason || readOnly) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    const submitted = snapshot;
    try {
      await updateRole(role.id, {
        settings: {
          questionsPerSession: perSessionN,
          questionOrder: order,
          answerGuideSeconds: guideSeconds,
          requireAllCards: requireCards,
          maxSessionsPerCandidate: maxSessions.trim() === "" ? null : maxN,
          sessionWeights: sessionW as SessionWeights,
          dimensionWeights: dimW as DimensionWeights,
        },
      });
      setSavedSnapshot(submitted);
      emitRoleChanged(role.id);
      toast.show({ title: "Settings saved" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save settings. Try again.");
      toast.show({ title: "Couldn't save settings", detail: e instanceof Error ? e.message : undefined });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const note = blockedReason
    ? weightsError && !perSessionError && !guideError && !maxError
      ? "Fix the highlighted totals to save"
      : "Fix the highlighted fields to save"
    : saving
      ? "Saving…"
      : saveError
        ? saveError
        : dirty
          ? "Unsaved changes"
          : "All changes saved";
  const noteWarn = Boolean(blockedReason || saveError);

  return (
    <fieldset disabled={readOnly || saving} className="m-0 flex min-w-0 max-w-[760px] flex-col gap-5 border-0 p-0">
      <legend className="sr-only">Role settings</legend>
      {readOnly && <p className="m-0 text-sm leading-5 text-ink-muted">This role is archived, so its settings can’t be changed.</p>}
      <Section title="Mock interview" className="gap-5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
          <Field
            label="Questions per session"
            helper={bank > 0 && bank <= MAX_PER_SESSION ? `Up to ${bank}, the size of the bank` : `Up to ${MAX_PER_SESSION}`}
            error={perSessionError}
            className={FIELD}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={MAX_PER_SESSION}
                inputMode="numeric"
                aria-describedby={describedBy}
                invalid={invalid}
                value={perSession}
                onChange={(e) => setPerSession(e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <div className="flex flex-col gap-2">
            <span id="order-label" className="text-sm leading-5 font-semibold text-ink">
              Question order
            </span>
            {/* Design track: input-line border, 2px gap, 16px × 8px segments. */}
            <div className="[&_[role=radio]]:h-[34px] [&_[role=radio]]:px-4 [&_[role=radiogroup]]:gap-0.5 [&_[role=radiogroup]]:border-input-line">
              <SegmentedControl
                label="Question order"
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "random", label: "Random" },
                ]}
                value={order}
                onChange={setOrder}
              />
            </div>
          </div>
          <Field label="Suggested answer length" helper="Shown to the candidate while answering" error={guideError} className={FIELD}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                placeholder="2:00"
                aria-describedby={describedBy}
                invalid={invalid}
                value={guide}
                onChange={(e) => setGuide(e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Field label="Max sessions per candidate" helper="Leave blank for no limit" error={maxError} className={FIELD}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                min={1}
                inputMode="numeric"
                aria-describedby={describedBy}
                invalid={invalid}
                value={maxSessions}
                onChange={(e) => setMaxSessions(e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
        </div>
        <div className="flex items-center gap-4 border-t border-line pt-[18px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p id="require-label" className="m-0 text-sm leading-5 font-semibold text-ink">
              Require all flash cards first
            </p>
            <p className="m-0 text-[13px] leading-[18px] text-ink-faint">
              Candidates view every card before they can start a mock interview.
            </p>
          </div>
          <Switch label="Require all flash cards first" checked={requireCards} onChange={setRequireCards} />
        </div>
      </Section>

      <Section title="Scoring" className="gap-7">
        <WeightBar
          label="Session score"
          description="How the two tries and improvement combine into one score."
          parts={SESSION_PARTS}
          values={sessionW}
          onChange={setSessionW}
        />
        <WeightBar
          label="Answer score"
          description="How each answer is scored across four dimensions."
          parts={DIMENSION_PARTS}
          values={dimW}
          onChange={setDimW}
        />
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          id="settings-save-note"
          role={saveError && !blockedReason ? "alert" : undefined}
          aria-live={saveError && !blockedReason ? undefined : "polite"}
          className={cn("m-0 text-[13px] leading-[18px]", noteWarn ? "text-improve-text" : "text-ink-faint")}
        >
          {note}
        </p>
        <Button
          variant="primary"
          disabled={saving || (!dirty && !saveError)}
          disabledReason={blockedReason}
          aria-describedby="settings-save-note"
          onClick={submit}
          className="h-[43px]! px-5!"
        >
          {saving ? "Saving…" : saveError ? "Retry save settings" : "Save settings"}
        </Button>
      </div>
    </fieldset>
  );
}
