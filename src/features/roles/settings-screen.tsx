"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { WeightBar, weightsValid } from "@/components/ui/weight-bar";
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-6">
      <h2 className="m-0 text-base font-semibold leading-6 text-ink">{title}</h2>
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
  const [followUp, setFollowUp] = useState(s.followUpEnabled ?? false);
  const [maxSessions, setMaxSessions] = useState(s.maxSessionsPerCandidate === null ? "" : String(s.maxSessionsPerCandidate));
  const [sessionW, setSessionW] = useState<Record<string, number>>({ ...s.sessionWeights });
  const [dimW, setDimW] = useState<Record<string, number>>({ ...s.dimensionWeights });
  const saveLock = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const perSessionN = Number(perSession);
  const perSessionError =
    perSession.trim() === "" || !Number.isInteger(perSessionN) || perSessionN < 1 || perSessionN > 20
      ? "Enter a whole number from 1 to 20"
      : undefined;
  const guideSeconds = parseDuration(guide);
  const guideError = !/^\d+:[0-5]\d$/.test(guide.trim()) || (guideSeconds < 15 || guideSeconds > 600) ? "Use 0:15 to 10:00" : undefined;
  const maxN = Number(maxSessions);
  const maxError =
    maxSessions.trim() !== "" && (!Number.isInteger(maxN) || maxN < 1 || maxN > 100) ? "Enter 1 to 100, or leave blank for no limit" : undefined;
  const weightsError = !weightsValid(sessionW)
    ? "Session score weights must add up to 100%"
    : !weightsValid(dimW)
      ? "Answer dimension weights must add up to 100%"
      : undefined;
  const blockedReason = perSessionError ?? guideError ?? maxError ?? weightsError;

  async function submit() {
    if (saveLock.current || blockedReason || readOnly) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateRole(role.id, {
        settings: {
          questionsPerSession: perSessionN,
          questionOrder: order,
          answerGuideSeconds: guideSeconds,
          requireAllCards: requireCards,
          // Always sent: the API treats an omitted value as false.
          followUpEnabled: followUp,
          maxSessionsPerCandidate: maxSessions.trim() === "" ? null : maxN,
          sessionWeights: sessionW as SessionWeights,
          dimensionWeights: dimW as DimensionWeights,
        },
      });
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

  return (
    <fieldset disabled={readOnly || saving} className="m-0 flex min-w-0 max-w-[760px] flex-col gap-6 border-0 p-0">
      <legend className="sr-only">Role settings</legend>
      {readOnly && <p className="m-0 text-sm text-ink-muted">This role is archived, so its settings can’t be changed.</p>}
      <Section title="Mock interview">
        <div className="grid grid-cols-1 gap-5 min-[700px]:grid-cols-2">
          <Field label="Questions per session" error={perSessionError}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                aria-describedby={describedBy}
                invalid={invalid}
                value={perSession}
                onChange={(e) => setPerSession(e.target.value)}
                className="w-28"
              />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="order-label" className="text-[13px] leading-5 font-semibold text-ink">
              Question order
            </span>
            <div>
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
          <Field label="Answer guide" helper="Suggested length shown while answering" error={guideError}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                placeholder="2:00"
                aria-describedby={describedBy}
                invalid={invalid}
                value={guide}
                onChange={(e) => setGuide(e.target.value)}
                className="w-28"
              />
            )}
          </Field>
          <Field label="Max sessions per candidate" helper="Leave blank for no limit" error={maxError}>
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
                className="w-28"
              />
            )}
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p id="require-label" className="m-0 text-sm font-semibold text-ink">
              Require all flash cards first
            </p>
            <p className="m-0 text-xs leading-4 text-ink-muted">Candidates go through every card before they start a mock interview.</p>
          </div>
          <Switch label="Require all flash cards first" checked={requireCards} onChange={setRequireCards} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-sm font-semibold text-ink">AI follow-up question</p>
            <p className="m-0 text-xs leading-4 text-ink-muted">If a first answer is too vague to score, the AI asks one short probing question, and the retry answers it.</p>
          </div>
          <Switch label="AI follow-up question" checked={followUp} onChange={setFollowUp} />
        </div>
      </Section>

      <Section title="Scoring">
        <WeightBar label="Session score" parts={SESSION_PARTS} values={sessionW} onChange={setSessionW} />
        <WeightBar label="Answer dimensions" parts={DIMENSION_PARTS} values={dimW} onChange={setDimW} />
      </Section>

      {saveError && <p role="alert" className="m-0 text-sm text-improve-text">{saveError}</p>}
      <div className="flex justify-end">
        <Button variant="primary" disabled={saving} disabledReason={blockedReason} onClick={submit}>
          {saving ? "Saving…" : saveError ? "Retry save settings" : "Save settings"}
        </Button>
      </div>
    </fieldset>
  );
}
