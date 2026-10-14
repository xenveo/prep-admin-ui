"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { AUDIO_RETENTION_OPTIONS, TRANSCRIPT_RETENTION_LABEL, type TranscriptRetention, type WorkspaceSettings } from "@/lib/types";
import { exportAllData } from "@/services/settings";
import { ErrorBanner, LoadingCard } from "./load-state";
import { SettingRow, SettingsCard } from "./setting-row";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

const TRANSCRIPT_ORDER: TranscriptRetention[] = ["6m", "12m", "until_removed"];

/** Describes retention periods that got shorter, for the confirmation. */
function shortenings(saved: WorkspaceSettings, next: WorkspaceSettings): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  if (next.audioRetentionDays < saved.audioRetentionDays) {
    const n = next.audioRetentionDays;
    out.push({
      title: `Shorten audio retention to ${n} days?`,
      body: `Recordings older than ${n} days are deleted tonight and can't be recovered.`,
    });
  }
  if (TRANSCRIPT_ORDER.indexOf(next.transcriptRetention) < TRANSCRIPT_ORDER.indexOf(saved.transcriptRetention)) {
    const label = TRANSCRIPT_RETENTION_LABEL[next.transcriptRetention].toLowerCase();
    out.push({
      title: `Shorten transcript retention to ${label}?`,
      body: `Transcripts older than ${label} are deleted tonight and can't be recovered. Scores are kept.`,
    });
  }
  return out;
}

export function PrivacySection() {
  const draft = useSettingsDraft();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null | undefined>(undefined);

  const shortened = draft.saved && draft.values ? shortenings(draft.saved, draft.values) : [];

  function onSave() {
    if (shortened.length > 0) setConfirming(true);
    else void draft.save();
  }
  useSaveHeader(draft, onSave);

  async function onExport() {
    setExporting(true);
    try {
      const r = await exportAllData();
      setLastExport(r.lastExportAt);
      toast.show({ title: "Export started", detail: "Candidate, session and score CSV files are being prepared." });
    } catch {
      toast.show({ title: "Couldn't start the export", detail: "Try again." });
    } finally {
      setExporting(false);
    }
  }

  if (draft.loadError && !draft.values) return <ErrorBanner message="Couldn't load settings. Try again." onRetry={draft.reload} />;
  if (!draft.values) return <LoadingCard />;
  const v = draft.values;
  const exportedAt = lastExport === undefined ? v.lastExportAt : lastExport;
  const first = shortened[0];

  return (
    <>
      {draft.saveError && <ErrorBanner message={draft.saveError} />}
      <SettingsCard title="Retention">
        <SettingRow label="Keep audio recordings for" htmlFor="aud" hint="Default 30 days">
          <span className="flex flex-col gap-1">
            <Select
              id="aud"
              className="w-[200px]"
              value={String(v.audioRetentionDays)}
              onChange={(e) => draft.set("audioRetentionDays", Number(e.target.value) as WorkspaceSettings["audioRetentionDays"])}
              aria-describedby="aud-help"
            >
              {AUDIO_RETENTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </Select>
            <span id="aud-help" className="text-xs leading-4 text-ink-muted">
              Audio is deleted automatically after this. Transcripts and scores are kept.
            </span>
          </span>
        </SettingRow>
        <SettingRow label="Keep transcripts for" htmlFor="tr">
          <Select
            id="tr"
            className="w-[260px]"
            value={v.transcriptRetention}
            onChange={(e) => draft.set("transcriptRetention", e.target.value as TranscriptRetention)}
          >
            {TRANSCRIPT_ORDER.map((k) => (
              <option key={k} value={k}>
                {TRANSCRIPT_RETENTION_LABEL[k]}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Candidates can delete their data" labelId="del-l" hint="Recordings, transcripts and scores, from their account page">
          <div className="justify-self-start">
            <Switch
              label="Candidates can delete their data"
              checked={v.candidatesCanDeleteData}
              onChange={(c) => draft.set("candidatesCanDeleteData", c)}
            />
          </div>
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Data export" className="gap-2">
        <p className="m-0 text-ink">Download every candidate, session and score as CSV files. Audio isn’t included.</p>
        <div className="flex items-center gap-3">
          <Button onClick={() => void onExport()} disabled={exporting} aria-busy={exporting || undefined}>
            {exporting ? "Preparing…" : "Export all data"}
          </Button>
          <span className="text-xs leading-4 text-ink-muted">Last export: {exportedAt ? formatDate(exportedAt) : "never"}</span>
        </div>
      </SettingsCard>
      <ConfirmDialog
        open={confirming && Boolean(first)}
        tone="destructive"
        title={first?.title ?? ""}
        body={first?.body ?? ""}
        bullets={shortened.slice(1).map((s) => `${s.title.replace(/\?$/, "")}. ${s.body}`)}
        confirmLabel="Shorten and save"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void draft.save();
        }}
      />
    </>
  );
}
