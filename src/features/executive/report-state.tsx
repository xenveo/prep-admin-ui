import { Button } from "@/components/ui/button";
export function ReportLoading({
  label = "Loading report…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-panel border border-line bg-surface px-6 py-10 text-sm text-ink-muted"
    >
      {label}
    </div>
  );
}
export function ReportError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-surface p-6"
    >
      <div>
        <h2 className="m-0 text-base font-semibold text-ink">
          Could not load the report
        </h2>
        <p className="mt-1 mb-0 text-sm text-ink-muted">
          {error.message || "Check your connection and try again."}
        </p>
      </div>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
