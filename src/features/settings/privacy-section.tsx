"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { AUDIO_RETENTION_OPTIONS, TRANSCRIPT_RETENTION_LABEL, type TranscriptRetention, type WorkspaceSettings } from "@/lib/types";
import { exportAllData, getWorkspaceExport, downloadExportFile, listPrivacyRequests, completePrivacyRequest, type WorkspaceExport, type PrivacyRequest } from "@/services/settings";
import { ErrorBanner, LoadingCard } from "./load-state";
import { isAccessDenied, settingsErrorMessage } from "./error-copy";
import { SettingRow, SettingsCard } from "./setting-row";
import { useSettingsContext } from "./settings-context";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

const EXPORT_UNAVAILABLE = "This export isn’t available. The link may be wrong or the export was removed. Start a new export.";
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
  const { admin } = useSettingsContext();
  const exportKey = `preppilot:workspace-export:${admin?.id ?? ""}`;
  const url = useUrlState();
  // ?exportId= comes from the export-ready email and wins over this tab's last export.
  const urlExportId = url.get("exportId");
  const [dismissedUrlId, setDismissedUrlId] = useState<string | null>(null);
  const [storedExportId, setStoredExportId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return sessionStorage.getItem(exportKey); } catch { return null; }
  });
  const exportId = urlExportId && urlExportId !== dismissedUrlId ? urlExportId : storedExportId;
  const [exporting, setExporting] = useState(Boolean(exportId));
  const [exportView, setExportView] = useState<WorkspaceExport | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportGone, setExportGone] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  useEffect(() => {
    if (!exportId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let count = 0;
    async function poll() {
      try {
        const result = await getWorkspaceExport(exportId!, controller.signal);
        if (controller.signal.aborted) return;
        setExportView(result);
        setExportError(null);
        setExportGone(false);
        if (result.status === "queued" || result.status === "running") {
          if (Date.now() - started > 120000) {
            setExportError("The export is still processing. Check its status again in a moment.");
            setExporting(false);
          } else timer = setTimeout(() => void poll(), Math.min(1000 * ++count, 5000));
        } else setExporting(false);
      } catch (e) {
        if (controller.signal.aborted) return;
        // Unknown or malformed ids are final; retrying would only repeat the 404/400.
        const gone = e instanceof ApiError && (e.status === 404 || e.status === 400);
        if (gone) {
          setExportView(null);
          try { if (sessionStorage.getItem(exportKey) === exportId) sessionStorage.removeItem(exportKey); } catch { /* Nothing stored. */ }
        }
        setExportGone(gone);
        setExportError(gone && !isAccessDenied(e) ? EXPORT_UNAVAILABLE : settingsErrorMessage(e, "Couldn’t check export status."));
        setExporting(false);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [exportId, exportKey, pollTick]);
  async function downloadFile(name: string) {
    if (!exportId || downloading) return;
    setDownloading(name); setExportError(null);
    try {
      const current = await getWorkspaceExport(exportId);
      setExportView(current);
      const file = current.files.find((f) => f.name === name);
      if (current.status !== "done" || !file) throw new Error("This export is no longer available. Start a new export.");
      await downloadExportFile(file);
    } catch (e) { setExportError(settingsErrorMessage(e, "Couldn’t download this file.")); }
    finally { setDownloading(null); }
  }
  const [lastExport, setLastExport] = useState<string | null | undefined>(undefined);

  const shortened = draft.saved && draft.values ? shortenings(draft.saved, draft.values) : [];

  function onSave() {
    if (shortened.length > 0) setConfirming(true);
    else void draft.save();
  }
  useSaveHeader(draft, onSave);

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    setExportGone(false);
    try {
      const r = await exportAllData();
      setLastExport(r.lastExportAt);
      setExportView({ status: "queued", files: [] });
      setStoredExportId(r.exportId);
      if (urlExportId) {
        // The emailed export no longer applies; useUrlState writes with router.replace.
        setDismissedUrlId(urlExportId);
        url.set({ exportId: null });
      }
      try { sessionStorage.setItem(exportKey, r.exportId); } catch { /* Status remains available in this view. */ }
      toast.show({ title: "Export started", detail: "Candidate, session and score CSV files are being prepared." });
    } catch (e) {
      setExportError(settingsErrorMessage(e, "Couldn’t start the export."));
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
        <p className="m-0 text-ink">Download every candidate, session and score as CSV files. Audio isn’t included. External storage files may open in your browser.</p>
        <div className="flex items-center gap-3">
          <Button onClick={() => void onExport()} disabled={exporting} aria-busy={exporting || undefined}>
            {exporting ? "Preparing…" : "Export all data"}
          </Button>
          <span className="text-xs leading-4 text-ink-muted">Last export: {exportedAt ? formatDate(exportedAt) : "never"}</span>
        </div>
        {exportView && <p role="status" className="m-0 text-sm">Export: {exportView.status}{exportView.status === "failed" ? ". The export failed. Start a new export." : exportView.status === "expired" ? ". Download links expired. Start a new export." : exportView.status === "done" ? ". Files are available for 24 hours." : ". CSV files are being prepared."}</p>}
        {exportError && <ErrorBanner message={exportError} onRetry={exportId && !exportGone ? () => { setExporting(true); setPollTick((n) => n + 1); } : undefined} />}
        {exportView?.status === "done" && <div className="flex flex-wrap gap-2">{exportView.files.map((file) => <Button key={file.name} disabled={downloading !== null} onClick={() => void downloadFile(file.name)}>{downloading === file.name ? "Downloading…" : `Download ${file.name}`}</Button>)}</div>}
      </SettingsCard>
      <PrivacyRequests />
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

/** G4: pending and recent requests, with server cursor navigation and explicit completion. */
function PrivacyRequests() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const requests = useAsync(() => listPrivacyRequests(cursor), [cursor]);
  const [selected, setSelected] = useState<PrivacyRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  async function complete() {
    if (!selected || busy) return;
    const request = selected;
    setSelected(null); setBusy(true); setError(null);
    try {
      await completePrivacyRequest(request.id);
      toast.show({ title: request.kind === "deletion" ? "Deletion processing started" : "Candidate export queued", detail: request.kind === "deletion" ? "The erasure job will process the candidate’s data." : "The candidate will receive their download link by email." });
      requests.reload();
    } catch (e) { setError(settingsErrorMessage(e, "Couldn’t complete this request.")); }
    finally { setBusy(false); }
  }
  const columns: Column<PrivacyRequest>[] = [
    { id: "candidate", header: "Candidate", render: (row) => <span className="flex flex-col"><span>{row.name ?? row.email}</span>{row.name && <span className="text-xs text-ink-muted">{row.email}</span>}</span> },
    { id: "kind", header: "Request", render: (row) => row.kind },
    { id: "status", header: "Status", render: (row) => row.status },
    { id: "created", header: "Requested", render: (row) => formatDate(row.createdAt) },
    { id: "action", header: "Action", render: (row) => row.status === "pending" ? <Button disabled={busy} onClick={() => setSelected(row)}>{row.kind === "deletion" ? "Process deletion" : "Queue export"}</Button> : <span className="text-xs text-ink-muted">{row.completedAt ? formatDate(row.completedAt) : "Handled"}</span> },
  ];
  return (
    <>
      {(error || requests.error) && <ErrorBanner message={error ?? settingsErrorMessage(requests.error, "Couldn’t load privacy requests.")} onRetry={requests.reload} />}
      <SettingsCard title="Privacy requests">
        <p className="m-0 text-xs text-ink-muted">Pending requests and requests from the last 30 days. Completed deletion requests start an erasure job.</p>
        <DataTable ariaLabel="Privacy requests" columns={columns} rows={requests.error ? [] : requests.data?.rows ?? []} rowId={(row) => row.id} loading={requests.loading} emptyState={<EmptyState icon="search" title="No privacy requests" description="Candidate requests will appear here." />} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-muted">Page {cursors.length} · {requests.data?.total ?? 0} requests</span>
          <div className="flex gap-2"><Button disabled={requests.loading || cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>Previous</Button><Button disabled={requests.loading || !requests.data?.nextCursor} onClick={() => { if (requests.data?.nextCursor) setCursors((c) => [...c, requests.data!.nextCursor!]); }}>Next</Button><Button disabled={requests.loading || busy} onClick={requests.reload}>Refresh</Button></div>
        </div>
      </SettingsCard>
      <ConfirmDialog open={selected !== null} title={selected?.kind === "deletion" ? "Process this deletion request?" : "Queue this candidate export?"} body={selected?.kind === "deletion" ? "This starts erasure of the candidate’s recordings, transcripts and scores and removes their access. The job runs asynchronously. This cannot be undone after erasure." : "The candidate’s personal data will be prepared and a download link emailed to them."} tone={selected?.kind === "deletion" ? "destructive" : "default"} confirmLabel={selected?.kind === "deletion" ? "Process deletion" : "Queue export"} onCancel={() => setSelected(null)} onConfirm={() => void complete()} />
    </>
  );
}
