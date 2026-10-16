"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/lib/use-async";
import { getAiConfig, saveAiConfig, voiceSampleUrl, type PromptRoleConfig, type ThinkingLevel } from "@/services/settings";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { VOICE_OPTIONS, type FeedbackLength } from "@/lib/types";
import { AiUsagePanel } from "./ai-usage-panel";
import { ErrorBanner, LoadingCard } from "./load-state";
import { settingsErrorMessage } from "./error-copy";
import { SettingRow, SettingsCard } from "./setting-row";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

export function AiSection({ readOnly }: { readOnly: boolean }) {
  const draft = useSettingsDraft();
  const audio = useRef<HTMLAudioElement>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  useEffect(() => { const player = audio.current; return () => player?.pause(); }, [draft.values?.voice]);
  useSaveHeader(draft, () => void draft.save(), !readOnly);

  if (draft.loadError && !draft.values) return <ErrorBanner message="Couldn't load settings. Try again." onRetry={draft.reload} />;
  if (!draft.values) return <LoadingCard />;
  const v = draft.values;

  return (
    <>
      {readOnly && (
        <p className="m-0 rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink-muted">
          Only super admins can change these settings. You can see what is set.
        </p>
      )}
      {draft.saveError && <ErrorBanner message={draft.saveError} />}
      <SettingsCard title="AI and voice">
        <SettingRow label="Interviewer voice" htmlFor="voice">
          <div className="flex flex-col gap-2">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Select
              id="voice"
              className="w-[220px]"
              value={v.voice}
              disabled={readOnly}
              onChange={(e) => draft.set("voice", e.target.value)}
            >
              {VOICE_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
            <Button
              iconLeft="play"
              onClick={() => {
                setSampleError(null);
                void audio.current?.play().catch(() => setSampleError("Couldn’t play the sample. Try again."));
              }}
            >
              Play sample
            </Button>
          </span>
          <audio ref={audio} src={voiceSampleUrl(v.voice)} controls preload="none" className="w-full max-w-[360px]" aria-label="Interviewer voice sample" onError={() => setSampleError("Voice sample unavailable. Try again.")} />
          {sampleError && <ErrorBanner message={sampleError} />}
          </div>
        </SettingRow>
        <SettingRow label="Feedback length" labelId="fb-l" hint="After each answer">
          <div className="justify-self-start">
            <SegmentedControl<FeedbackLength>
              label="Feedback length"
              options={[
                { value: "short", label: "Short" },
                { value: "standard", label: "Standard" },
              ]}
              value={v.feedbackLength}
              onChange={(x) => !readOnly && draft.set("feedbackLength", x)}
            />
          </div>
        </SettingRow>
        <SettingRow label="Language">
          <span className="inline-flex items-center gap-2 text-ink">
            <span className="text-ink-muted">
              <Icon name="lock" size={14} />
            </span>
            English <span className="text-xs text-ink-muted">· the only language for now</span>
          </span>
        </SettingRow>
      </SettingsCard>
      {!readOnly && (
        <>
          <PromptConfiguration />
          <AiUsagePanel />
        </>
      )}
    </>
  );
}

/** G4: versioned prompt roles are available only to Super admins. */
function PromptConfiguration() {
  const config = useAsync(getAiConfig, []);
  return (
    <>
      {config.error && <ErrorBanner message={settingsErrorMessage(config.error, "Couldn’t load AI configuration.")} onRetry={config.reload} />}
      {!config.data && config.loading && <LoadingCard />}
      {config.data?.roles.map((role) => <PromptEditor key={`${role.role}:${role.active.version}`} config={role} onSaved={config.reload} />)}
    </>
  );
}

const ROLE_LABEL: Record<string, string> = {
  interviewer: "Interviewer",
  evaluator: "Evaluator (scores and written feedback)",
  evaluator_detail: "Evaluator detail (spoken summary and highlights)",
  summariser: "Summariser",
  drafter: "Drafter",
};
const roleLabel = (role: string) => ROLE_LABEL[role] ?? `${role[0].toUpperCase()}${role.slice(1)}`;

const THINKING_OPTIONS: { value: ThinkingLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const thinkingLabel = (level: ThinkingLevel | null) => THINKING_OPTIONS.find((o) => o.value === level)?.label ?? "Model default";

function PromptEditor({ config, onSaved }: { config: PromptRoleConfig; onSaved: () => void }) {
  const [saved, setSaved] = useState(config.active);
  const [model, setModel] = useState(config.active.model);
  const [temperature, setTemperature] = useState(String(config.active.temperature));
  const [thinking, setThinking] = useState<ThinkingLevel | null>(config.active.thinkingLevel);
  const [template, setTemplate] = useState(config.active.template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const toast = useToast();
  const dirty = model !== saved.model || temperature !== String(saved.temperature) || thinking !== saved.thinkingLevel || template !== saved.template;
  async function save() {
    if (busy) return;
    const value = Number(temperature);
    if (!model.trim() || !template.trim() || temperature.trim() === "" || !Number.isFinite(value) || value < 0 || value > 1) {
      setError("Enter a model, a prompt and a temperature between 0 and 1.");
      return;
    }
    setBusy(true); setError(null); setModelError(null);
    try {
      // Null (model default) is never sent; the backend then keeps the active version's level.
      const next = await saveAiConfig({ role: config.role, model, temperature: value, ...(thinking ? { thinkingLevel: thinking } : {}), template });
      setSaved(next.active);
      setThinking(next.active.thinkingLevel);
      toast.show({ title: "Prompt version saved" });
      onSaved();
    } catch (e) {
      const message = settingsErrorMessage(e, "Couldn’t save AI configuration.");
      // The backend checks the model id with the provider: "Model <id> is not available".
      if (e instanceof ApiError && e.code === "validation_failed" && /\bis not available\b/i.test(message)) setModelError(message);
      else setError(message);
    }
    finally { setBusy(false); }
  }
  return (
    <SettingsCard title={`${roleLabel(config.role)} configuration`} className="gap-3">
      <p className="m-0 text-xs text-ink-muted">Active version {saved.version}. Saving creates a new active version.</p>
      {error && <ErrorBanner message={error} />}
      <Field label="Model" helper="Gemini model id, e.g. gemini-3.8-flash. Changes apply to new sessions only." error={modelError}>{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={model} maxLength={200} disabled={busy} onChange={(e) => { setModel(e.target.value); setModelError(null); }} />}</Field>
      <Field label="Temperature" helper="A number between 0 and 1.">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="number" min={0} max={1} step={0.01} value={temperature} disabled={busy} onChange={(e) => setTemperature(e.target.value)} />}</Field>
      <Field label="Thinking" helper="How much the model reasons before answering.">{({ id, describedBy }) => (
        <Select id={id} aria-describedby={describedBy} className="w-[220px]" value={thinking ?? ""} disabled={busy} onChange={(e) => setThinking((e.target.value || null) as ThinkingLevel | null)}>
          {/* The API can't reset a level to the model default, so that choice exists only while it is the saved value. */}
          {saved.thinkingLevel === null && <option value="">Model default</option>}
          {THINKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )}</Field>
      <Field label="System prompt" helper="Keep required template variables and safety instructions when editing.">{({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={8} maxLength={50000} value={template} disabled={busy} onChange={(e) => setTemplate(e.target.value)} />}</Field>
      <div className="self-start"><Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : "Save prompt version"}</Button></div>
      <details><summary className="cursor-pointer text-sm font-semibold">Version history ({config.versions.length})</summary>
        <ul className="text-xs text-ink-muted">{config.versions.map((version) => <li key={version.version}>Version {version.version} · {version.model} · temperature {version.temperature} · thinking {thinkingLabel(version.thinkingLevel).toLowerCase()} · {new Date(version.createdAt).toLocaleString()}{version.active ? " · active" : ""}</li>)}</ul>
        {!config.versions.length && <p className="text-xs text-ink-muted">Using the built-in default.</p>}
      </details>
    </SettingsCard>
  );
}
