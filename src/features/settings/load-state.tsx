import { Button } from "@/components/ui/button";

export function LoadingCard() {
  return <div aria-busy="true" aria-label="Loading" className="h-48 animate-pulse rounded-panel border border-line bg-surface" />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-improve bg-improve-soft px-4 py-3 text-sm leading-5 text-improve-text"
    >
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" className="!border-improve !text-improve-text" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
