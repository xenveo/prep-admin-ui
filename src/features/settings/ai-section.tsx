"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { VOICE_OPTIONS, type FeedbackLength } from "@/lib/types";
import { ErrorBanner, LoadingCard } from "./load-state";
import { SettingRow, SettingsCard } from "./setting-row";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

export function AiSection({ readOnly }: { readOnly: boolean }) {
  const draft = useSettingsDraft();
  const toast = useToast();
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
              onClick={() => toast.show({ title: `Playing a sample of "${v.voice}"`, detail: "Sample audio isn't connected yet." })}
            >
              Play sample
            </Button>
          </span>
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
    </>
  );
}
