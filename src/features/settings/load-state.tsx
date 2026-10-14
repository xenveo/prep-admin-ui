import { Button } from "@/components/ui/button";

export function LoadingCard() {
  return <div aria-busy="true" aria-label="Loading" className="h-48 rounded-md border border-line bg-surface" />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-improve bg-improve-soft px-4 py-2.5 text-sm text-improve-text">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
