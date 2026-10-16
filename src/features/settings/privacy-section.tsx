"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { AUDIO_RETENTION_OPTIONS, TRANSCRIPT_RETENTION_LABEL, type TranscriptRetention, type WorkspaceSettings } from "@/lib/types";
import { exportAllData, getWorkspaceExport, downloadExportFile, listPrivacyRequests, completePrivacyRequest, type WorkspaceExport, type PrivacyRequest } from "@/services/settings";
import { ErrorBanner, LoadingCard } from "./load-state";
import { isAccessDenied, settingsErrorMessage } from "./error-copy";
import { useSettingsContext } from "./settings-context";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

const EXPORT_UNAVAILABLE = "This export isn’t available. The link may be wrong or the export was removed. Start a new export.";
const TRANSCRIPT_ORDER: TranscriptRetention[] = ["6m", "12m", "until_removed"];

const EXPORT_STATUS: Record<WorkspaceExport["status"], string> = {
  queued: "Export queued. CSV files are being prepared.",
  running: "Export running. CSV files are being prepared.",
  done: "Export ready. Files are available for 24 hours.",
  failed: "The export failed. Start a new export.",
  expired: "Download links expired. Start a new export.",
};

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

/** Card title block: 17px title over a 13px faint line, with an optional action on the right. */
function CardHeader({ id, title, sub, action, className }: { id: string; title: string; sub: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-[22px] py-5", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="m-0 text-[17px] leading-[23px] font-semibold text-ink">
          {title}
        </h2>
        <p className="m-0 text-[13px] leading-5 text-ink-faint">{sub}</p>
      </div>
      {action}
    </div>
  );
}

/** Retention row: label + note column, then the option picker. */
function RetentionRow({ labelId, label, note, children }: { labelId: string; label: string; note: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-4 border-b border-line px-[22px] py-[18px] min-[720px]:grid-cols-[minmax(180px,260px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-[3px]">
        <span id={labelId} className="text-sm leading-5 font-semibold text-ink">
          {label}
        </span>
        <span className="text-[13px] leading-5 text-ink-faint">{note}</span>
      </div>
      <div className="min-w-0 justify-self-start">{children}</div>
    </div>
  );
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
      <section aria-labelledby="retention-h" className="rounded-panel border border-line bg-surface">
        <CardHeader
          id="retention-h"
          title="Retention"
          sub="Data is deleted automatically when it reaches these limits."
          className="border-b border-line"
        />
        <RetentionRow labelId="aud-l" label="Keep audio recordings for" note="Transcripts and scores are kept">
          <SegmentedControl
            label="Keep audio recordings for"
            value={String(v.audioRetentionDays)}
            options={AUDIO_RETENTION_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` }))}
            onChange={(d) => draft.set("audioRetentionDays", Number(d) as WorkspaceSettings["audioRetentionDays"])}
          />
        </RetentionRow>
        <RetentionRow labelId="tr-l" label="Keep transcripts for" note="Scores are kept">
          <SegmentedControl
            label="Keep transcripts for"
            value={v.transcriptRetention}
            options={TRANSCRIPT_ORDER.map((k) => ({ value: k, label: TRANSCRIPT_RETENTION_LABEL[k] }))}
            onChange={(k) => draft.set("transcriptRetention", k)}
          />
        </RetentionRow>
        <div className="flex items-center gap-4 px-[22px] py-[18px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-sm leading-5 font-semibold text-ink">Candidates can delete their data</span>
            <span className="text-[13px] leading-5 text-ink-faint">Recordings, transcripts and scores, from their account page</span>
          </div>
          <Switch
            label="Candidates can delete their data"
            checked={v.candidatesCanDeleteData}
            onChange={(c) => draft.set("candidatesCanDeleteData", c)}
          />
        </div>
      </section>
      <section aria-labelledby="export-h" className="flex flex-wrap items-center gap-4 rounded-panel border border-line bg-surface px-[22px] py-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h2 id="export-h" className="m-0 text-[17px] leading-[23px] font-semibold text-ink">
            Data export
          </h2>
          <p className="m-0 text-[13px] leading-[1.5] text-ink-muted">Every candidate, session and score as CSV files. Audio isn’t included.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] leading-5 text-ink-faint">Last export: {exportedAt ? formatDate(exportedAt) : "never"}</span>
          <Button
            iconLeft={exporting ? undefined : "download"}
            onClick={() => void onExport()}
            disabled={exporting}
            aria-busy={exporting || undefined}
            className="!border-neutral-line hover:!border-ink-faint"
          >
            {exporting ? "Preparing…" : "Export all data"}
          </Button>
        </div>
        {(exportView || exportError) && (
          <div className="flex basis-full flex-col gap-3 border-t border-line pt-4">
            {exportView && (
              <p role="status" className="m-0 text-[13px] leading-5 text-ink-soft">
                {EXPORT_STATUS[exportView.status]}
                {exportView.status === "done" && <span className="text-ink-faint"> External storage files may open in your browser.</span>}
              </p>
            )}
            {exportError && (
              <ErrorBanner
                message={exportError}
                onRetry={exportId && !exportGone ? () => { setExporting(true); setPollTick((n) => n + 1); } : undefined}
              />
            )}
            {exportView?.status === "done" && exportView.files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exportView.files.map((file) => (
                  <Button
                    key={file.name}
                    size="sm"
                    iconLeft="download"
                    aria-label={`Download ${file.name}`}
                    disabled={downloading !== null}
                    onClick={() => void downloadFile(file.name)}
                  >
                    {downloading === file.name ? "Downloading…" : file.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
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

function RequestStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[7px] py-px text-[11px] leading-4 font-semibold capitalize",
        status === "pending" ? "bg-improve-soft text-improve-text" : "bg-neutral-soft text-ink-faint",
      )}
    >
      {status}
    </span>
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
    {
      id: "candidate",
      header: "Candidate",
      width: "minmax(180px,2fr)",
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-ink">{row.name ?? row.email}</span>
          {row.name && <span className="truncate text-[13px] text-ink-faint">{row.email}</span>}
        </span>
      ),
    },
    { id: "kind", header: "Request", width: "minmax(100px,1fr)", render: (row) => <span className="capitalize text-ink-soft">{row.kind}</span> },
    { id: "status", header: "Status", width: "minmax(100px,1fr)", render: (row) => <RequestStatus status={row.status} /> },
    { id: "created", header: "Requested", width: "minmax(110px,1fr)", render: (row) => <span className="text-[13px] text-ink-faint">{formatDate(row.createdAt)}</span> },
    {
      id: "action",
      header: "Action",
      align: "right",
      width: "minmax(150px,1fr)",
      render: (row) =>
        row.status === "pending" ? (
          <Button size="sm" variant={row.kind === "deletion" ? "secondary" : "secondary-teal"} disabled={busy} onClick={() => setSelected(row)}>
            {row.kind === "deletion" ? "Process deletion" : "Queue export"}
          </Button>
        ) : (
          <span className="text-[13px] text-ink-faint">{row.completedAt ? formatDate(row.completedAt) : "Handled"}</span>
        ),
    },
  ];
  const paged = cursors.length > 1 || Boolean(requests.data?.nextCursor);
  return (
    <>
      {(error || requests.error) && <ErrorBanner message={error ?? settingsErrorMessage(requests.error, "Couldn’t load privacy requests.")} onRetry={requests.reload} />}
      <section aria-labelledby="requests-h" className="overflow-hidden rounded-panel border border-line bg-surface">
        <CardHeader
          id="requests-h"
          title="Privacy requests"
          sub="Pending requests and those from the last 30 days. Approved deletions start an erasure job."
          action={
            <Button
              variant="ghost"
              size="sm"
              iconLeft="refresh"
              disabled={requests.loading || busy}
              onClick={requests.reload}
              className="!px-1 hover:!bg-transparent"
            >
              Refresh
            </Button>
          }
        />
        <DataTable
          ariaLabel="Privacy requests"
          className="!rounded-none !border-x-0 !border-b-0 !bg-transparent"
          columns={columns}
          rows={requests.error ? [] : requests.data?.rows ?? []}
          rowId={(row) => row.id}
          loading={requests.loading}
          emptyState={
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[15px] leading-6 font-semibold text-ink">No privacy requests</span>
              <span className="text-[13px] leading-5 text-ink-faint">When a candidate asks to see or delete their data, it appears here.</span>
            </div>
          }
        />
        {paged && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-[22px] py-3">
            <span className="text-[13px] text-ink-faint">Page {cursors.length} · {requests.data?.total ?? 0} requests</span>
            <div className="flex gap-2">
              <Button size="sm" disabled={requests.loading || cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
                Previous
              </Button>
              <Button size="sm" disabled={requests.loading || !requests.data?.nextCursor} onClick={() => { if (requests.data?.nextCursor) setCursors((c) => [...c, requests.data!.nextCursor!]); }}>
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
      <ConfirmDialog open={selected !== null} title={selected?.kind === "deletion" ? "Process this deletion request?" : "Queue this candidate export?"} body={selected?.kind === "deletion" ? "This starts erasure of the candidate’s recordings, transcripts and scores and removes their access. The job runs asynchronously. This cannot be undone after erasure." : "The candidate’s personal data will be prepared and a download link emailed to them."} tone={selected?.kind === "deletion" ? "destructive" : "default"} confirmLabel={selected?.kind === "deletion" ? "Process deletion" : "Queue export"} onCancel={() => setSelected(null)} onConfirm={() => void complete()} />
    </>
  );
}
