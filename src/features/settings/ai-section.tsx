"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatShortDateTime } from "@/lib/format";
import { VOICE_OPTIONS, type FeedbackLength } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { getAiConfig, saveAiConfig, voiceSampleUrl, type PromptRole, type PromptRoleConfig, type ThinkingLevel } from "@/services/settings";
import { settingsErrorMessage } from "./error-copy";
import { ErrorBanner, LoadingCard } from "./load-state";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

/** Settings card: 17px title + 13px subtitle over a hairline. */
function Card({ title, sub, children, className }: { title: string; sub: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-panel border border-line bg-surface", className)}>
      <div className="flex flex-col gap-1 border-b border-line px-[22px] py-[18px]">
        <h2 id={id} className="m-0 text-[17px] leading-[23px] font-semibold text-ink">{title}</h2>
        <p className="m-0 text-[13px] leading-[18px] text-ink-faint">{sub}</p>
      </div>
      {children}
    </section>
  );
}

/** Label column (160–220px) + control column; rows are separated by hairlines. */
function Row({ label, hint, labelId, children }: { label: string; hint?: string; labelId?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-3 border-b border-line px-[22px] py-5 last:border-b-0 min-[720px]:grid-cols-[minmax(160px,220px)_minmax(0,1fr)]">
      <div id={labelId} className="flex flex-col gap-[3px]">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="text-[13px] leading-[18px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const FEEDBACK_NOTE: Record<FeedbackLength, string> = {
  short: "One line each for what worked and what to improve",
  standard: "Two to three sentences each, plus a suggested opening",
};

export function AiSection({ readOnly }: { readOnly: boolean }) {
  const draft = useSettingsDraft();
  useSaveHeader(draft, () => void draft.save(), !readOnly);

  if (draft.loadError && !draft.values) return <ErrorBanner message="Couldn't load settings. Try again." onRetry={draft.reload} />;
  if (!draft.values) return <LoadingCard />;
  const v = draft.values;

  return (
    <>
      {readOnly && (
        <p className="m-0 rounded-card border border-line bg-surface px-4 py-2.5 text-sm text-ink-muted">
          Only super admins can change these settings. You can see what is set.
        </p>
      )}
      {draft.saveError && <ErrorBanner message={draft.saveError} />}
      <Card title="Interviewer voice and feedback" sub="What candidates hear and read. Applies to new sessions.">
        <Row label="Voice" hint="Used to read questions aloud" labelId="voice-l">
          <VoicePicker value={v.voice} readOnly={readOnly} onChange={(x) => draft.set("voice", x)} />
        </Row>
        <Row label="Feedback length" hint="After each answer">
          <div className="flex flex-wrap items-center gap-3.5">
            <SegmentedControl<FeedbackLength>
              label="Feedback length"
              options={[
                { value: "short", label: "Short" },
                { value: "standard", label: "Standard" },
              ]}
              value={v.feedbackLength}
              onChange={(x) => !readOnly && draft.set("feedbackLength", x)}
            />
            <span className="text-[13px] leading-[18px] text-ink-faint">{FEEDBACK_NOTE[v.feedbackLength]}</span>
          </div>
        </Row>
        <Row label="Language">
          <span className="text-sm text-ink">
            English <span className="text-[13px] text-ink-faint">· the only language for now</span>
          </span>
        </Row>
      </Card>
      {!readOnly && <PromptConfiguration />}
    </>
  );
}

function VoicePicker({ value, readOnly, onChange }: { value: string; readOnly: boolean; onChange: (voice: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const options = VOICE_OPTIONS.includes(value) ? VOICE_OPTIONS : [value, ...VOICE_OPTIONS];
  const active = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const player = audio.current;
    return () => player?.pause();
  }, []);

  function toggleSample(voice: string) {
    const player = audio.current;
    if (!player) return;
    setSampleError(null);
    if (playing === voice) {
      player.pause();
      setPlaying(null);
      return;
    }
    player.pause();
    player.src = voiceSampleUrl(voice);
    setPlaying(voice);
    player.play().catch(() => {
      setPlaying(null);
      setSampleError("Couldn’t play the sample. Try again.");
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    let next = active;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (active + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (active - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next]);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={group} role="radiogroup" aria-labelledby="voice-l" onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {options.map((voice, i) => {
          const on = i === active;
          const isPlaying = playing === voice;
          return (
            <div
              key={voice}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] border py-2 pr-2 pl-3.5",
                on ? "border-primary-line bg-primary-tint" : "border-input-line bg-surface-sunken",
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={readOnly || undefined}
                tabIndex={on ? 0 : -1}
                onClick={() => !readOnly && onChange(voice)}
                className={cn("flex items-center gap-2 rounded-sm text-sm font-semibold text-ink", readOnly ? "cursor-default" : "cursor-pointer")}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-3.5 shrink-0 rounded-full", on ? "border-4 border-primary" : "border-[1.5px] border-neutral-line")}
                />
                {voice}
              </button>
              <button
                type="button"
                aria-label={isPlaying ? `Stop ${voice} sample` : `Play ${voice} sample`}
                onClick={() => toggleSample(voice)}
                className={cn(
                  "grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full",
                  isPlaying ? "bg-primary text-on-primary" : "bg-neutral-soft text-ink hover:bg-selected",
                )}
              >
                <Icon name={isPlaying ? "pause" : "play"} size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <audio
        ref={audio}
        preload="none"
        className="hidden"
        onEnded={() => setPlaying(null)}
        onError={() => {
          if (!audio.current?.getAttribute("src")) return;
          setPlaying(null);
          setSampleError("Voice sample unavailable. Try again.");
        }}
      />
      {sampleError && <ErrorBanner message={sampleError} />}
    </div>
  );
}

const ROLE_COPY: Record<PromptRole, { label: string; sub: string; desc: string }> = {
  interviewer: { label: "Interviewer", sub: "Asks questions", desc: "Runs the voice mock interview and reads each question." },
  evaluator: { label: "Evaluator", sub: "Scores and written feedback", desc: "Scores each answer and writes what worked and what to improve." },
  evaluator_detail: { label: "Evaluator detail", sub: "Spoken summary, highlights", desc: "Adds the spoken summary and transcript highlights after scoring." },
  summariser: { label: "Summariser", sub: "Session summaries", desc: "Summarises each practice session." },
  drafter: { label: "Content drafting", sub: "Flash cards and questions", desc: "Drafts flash cards and questions from a job role description." },
};
const roleCopy = (role: string) =>
  ROLE_COPY[role as PromptRole] ?? { label: `${role[0]?.toUpperCase() ?? ""}${role.slice(1)}`, sub: "", desc: "" };

/** G4: versioned prompt roles are available only to Super admins. */
function PromptConfiguration() {
  const config = useAsync(getAiConfig, []);
  const [selected, setSelected] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const roles = config.data?.roles ?? [];
  const activeIndex = Math.max(0, roles.findIndex((r) => r.role === selected));

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    let next = activeIndex;
    if (e.key === "ArrowRight") next = (activeIndex + 1) % roles.length;
    else if (e.key === "ArrowLeft") next = (activeIndex - 1 + roles.length) % roles.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = roles.length - 1;
    else return;
    e.preventDefault();
    setSelected(roles[next].role);
    tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <section aria-labelledby={`${baseId}-t`} className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex flex-col gap-1 px-[22px] pt-[18px]">
        <h2 id={`${baseId}-t`} className="m-0 text-[17px] leading-[23px] font-semibold text-ink">AI models and prompts</h2>
        <p className="m-0 text-[13px] leading-[18px] text-ink-faint">Saving a prompt creates a new active version. Changes apply to new sessions only.</p>
      </div>
      {roles.length > 0 ? (
        <>
          <div ref={tabsRef} role="tablist" aria-label="AI roles" onKeyDown={onTabKey} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-[22px] pt-3.5">
            {roles.map((r, i) => {
              const on = i === activeIndex;
              const copy = roleCopy(r.role);
              return (
                <button
                  key={r.role}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${r.role}`}
                  aria-selected={on}
                  aria-controls={`${baseId}-panel-${r.role}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setSelected(r.role)}
                  className={cn(
                    "focus-inset -mb-px flex flex-none cursor-pointer flex-col items-start gap-0.5 border-b-2 px-3 pt-2 pb-2.5 text-left",
                    on ? "border-primary" : "border-transparent",
                  )}
                >
                  <span className={cn("text-sm font-semibold", on ? "text-ink" : "text-ink-muted")}>{copy.label}</span>
                  {copy.sub && <span className="text-[11px] leading-[14px] text-ink-faint">{copy.sub}</span>}
                </button>
              );
            })}
          </div>
          {roles.map((r, i) => (
            <div
              key={`${r.role}:${r.active.version}`}
              role="tabpanel"
              id={`${baseId}-panel-${r.role}`}
              aria-labelledby={`${baseId}-tab-${r.role}`}
              hidden={i !== activeIndex}
            >
              <PromptEditor config={r} onSaved={config.reload} />
            </div>
          ))}
        </>
      ) : (
        <div className="flex flex-col gap-3 p-[22px]">
          {config.error && <ErrorBanner message={settingsErrorMessage(config.error, "Couldn’t load AI configuration.")} onRetry={config.reload} />}
          {!config.error && config.loading && <div aria-busy="true" aria-label="Loading" className="h-48 rounded-[10px] bg-surface-sunken" />}
          {!config.error && !config.loading && <p className="m-0 text-sm text-ink-muted">No AI roles to configure.</p>}
        </div>
      )}
      {roles.length > 0 && config.error && (
        <div className="px-[22px] pb-[22px]">
          <ErrorBanner message={settingsErrorMessage(config.error, "Couldn’t load AI configuration.")} onRetry={config.reload} />
        </div>
      )}
    </section>
  );
}

const THINKING_OPTIONS: { value: ThinkingLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const thinkingLabel = (level: ThinkingLevel | null) => THINKING_OPTIONS.find((o) => o.value === level)?.label ?? "Model default";

/** Template variables ({{name}}) used by a prompt, in first-seen order. */
function templateVars(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g), (m) => m[1]))];
}
const hasVar = (template: string, name: string) => new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(template);

function PromptEditor({ config, onSaved }: { config: PromptRoleConfig; onSaved: () => void }) {
  const [saved, setSaved] = useState(config.active);
  const [model, setModel] = useState(config.active.model);
  const [temperature, setTemperature] = useState(config.active.temperature);
  const [thinking, setThinking] = useState<ThinkingLevel | null>(config.active.thinkingLevel);
  const [template, setTemplate] = useState(config.active.template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const toast = useToast();
  const id = useId();
  const copy = roleCopy(config.role);

  const dirty = model !== saved.model || temperature !== saved.temperature || thinking !== saved.thinkingLevel || template !== saved.template;
  // Variables the active version uses are treated as required: the prompt breaks without them.
  const requiredVars = templateVars(saved.template);
  const missing = requiredVars.filter((name) => !hasVar(template, name));
  const canSave = dirty && missing.length === 0 && !busy;
  const nextVersion = Math.max(saved.version, ...config.versions.map((x) => x.version)) + 1;

  function discard() {
    setModel(saved.model);
    setTemperature(saved.temperature);
    setThinking(saved.thinkingLevel);
    setTemplate(saved.template);
    setError(null);
    setModelError(null);
  }

  async function save() {
    if (!canSave) return;
    if (!model.trim() || !template.trim()) {
      setError("Enter a model and a prompt.");
      return;
    }
    setBusy(true); setError(null); setModelError(null);
    try {
      // Null (model default) is never sent; the backend then keeps the active version's level.
      const next = await saveAiConfig({ role: config.role, model, temperature, ...(thinking ? { thinkingLevel: thinking } : {}), template });
      setSaved(next.active);
      setThinking(next.active.thinkingLevel);
      toast.show({ title: `${copy.label} prompt saved as v${next.active.version}` });
      onSaved();
    } catch (e) {
      const message = settingsErrorMessage(e, "Couldn’t save AI configuration.");
      // The backend checks the model id with the provider: "Model <id> is not available".
      if (e instanceof ApiError && e.code === "validation_failed" && /\bis not available\b/i.test(message)) setModelError(message);
      else setError(message);
    }
    finally { setBusy(false); }
  }

  const thinkingOptions: { value: ThinkingLevel | "default"; label: string }[] = [
    // The API can't reset a level to the model default, so that choice exists only while it is the saved value.
    ...(saved.thinkingLevel === null ? [{ value: "default" as const, label: "Default" }] : []),
    ...THINKING_OPTIONS,
  ];

  return (
    <div className="flex flex-col gap-[22px] p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {copy.desc && <span className="text-sm text-ink-muted">{copy.desc}</span>}
        <span className="rounded-chip bg-primary-tint px-2.5 py-[3px] text-xs leading-4 font-semibold text-primary-text">Active · v{saved.version}</span>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-model`} className="text-sm font-semibold text-ink">Model</label>
          <Input
            id={`${id}-model`}
            aria-describedby={`${id}-model-h`}
            invalid={Boolean(modelError)}
            className="h-10! font-mono text-[13px]!"
            value={model}
            maxLength={200}
            disabled={busy}
            spellCheck={false}
            onChange={(e) => { setModel(e.target.value); setModelError(null); }}
          />
          <span id={`${id}-model-h`} className={cn("text-xs leading-4", modelError ? "text-improve-text" : "text-ink-faint")}>
            {modelError ?? "Gemini model id"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-temp`} className="flex justify-between text-sm font-semibold text-ink">
            Temperature <span className="font-mono text-[13px] text-primary-text">{temperature}</span>
          </label>
          <input
            id={`${id}-temp`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={temperature}
            disabled={busy}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="m-0 h-10 w-full cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
          />
          <span aria-hidden="true" className="flex justify-between text-xs leading-4 text-ink-faint"><span>Consistent</span><span>Varied</span></span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink">Thinking</span>
          <SegmentedControl<ThinkingLevel | "default">
            label="Thinking"
            options={thinkingOptions}
            value={thinking ?? "default"}
            onChange={(x) => !busy && setThinking(x === "default" ? null : x)}
          />
          <span className="text-xs leading-4 text-ink-faint">How much the model reasons first</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={`${id}-prompt`} className="text-sm font-semibold text-ink">System prompt</label>
          <span className="text-xs leading-4 text-ink-faint">{template.length.toLocaleString("en-US")} characters</span>
        </div>
        {requiredVars.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs leading-4 text-ink-faint">Required variables</span>
            {requiredVars.map((name) => {
              const ok = !missing.includes(name);
              return (
                <span
                  key={name}
                  className={cn(
                    "rounded-sm border px-2 py-[3px] font-mono text-xs leading-4",
                    ok ? "border-primary-line bg-primary-tint text-primary-text" : "border-improve bg-improve-soft text-improve-text",
                  )}
                >
                  <span aria-hidden="true">{ok ? "✓" : "!"} </span>
                  {name}
                  {!ok && <span className="sr-only"> (missing)</span>}
                </span>
              );
            })}
          </div>
        )}
        <Textarea
          id={`${id}-prompt`}
          aria-describedby={missing.length ? `${id}-prompt-w` : undefined}
          invalid={missing.length > 0}
          rows={12}
          maxLength={50000}
          spellCheck={false}
          value={template}
          disabled={busy}
          onChange={(e) => setTemplate(e.target.value)}
          className="rounded-[10px]! p-3.5! font-mono text-[13px]! leading-[1.65]! text-ink-soft!"
        />
        {missing.length > 0 && (
          <span id={`${id}-prompt-w`} className="text-[13px] leading-[18px] text-improve-text">
            Add the missing variables back before saving. Keep the safety rules too.
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-[18px]">
        <button
          type="button"
          aria-expanded={historyOpen}
          aria-controls={`${id}-history`}
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex cursor-pointer items-center gap-2 rounded-sm text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true" className={cn("inline-flex transition-transform duration-150", historyOpen && "rotate-90")}>
            <Icon name="chevron-right" size={14} />
          </span>
          Version history · {config.versions.length}
        </button>
        <span className="flex-1" />
        {dirty && !busy && <Button variant="ghost" onClick={discard}>Discard</Button>}
        <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
          {busy ? "Saving…" : `Save as v${nextVersion}`}
        </Button>
      </div>
      {historyOpen && (
        <div id={`${id}-history`} className="rounded-[10px] border border-line bg-surface-sunken">
          {config.versions.length === 0 ? (
            <p className="m-0 px-3.5 py-3 text-[13px] text-ink-muted">Using the built-in default.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {config.versions.map((version, i) => (
                <li
                  key={version.version}
                  className={cn("grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3", i > 0 && "border-t border-line")}
                >
                  <span className="font-mono text-[13px] font-semibold text-ink">v{version.version}</span>
                  <span className="min-w-0 text-[13px] text-ink-muted">
                    {version.createdBy ?? "System"} · {formatShortDateTime(version.createdAt)}
                    <span className="text-ink-faint"> · {version.model} · temperature {version.temperature} · thinking {thinkingLabel(version.thinkingLevel).toLowerCase()}</span>
                  </span>
                  {version.active ? <span className="text-xs font-semibold text-primary-text">Active</span> : <span />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
