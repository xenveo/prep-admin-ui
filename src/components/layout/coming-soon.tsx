/** Placeholder body used by routes that a later wave fills in. */
export function ComingSoon({ children = "This screen is coming soon." }: { children?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-8 text-sm text-ink-muted">
      {children}
    </div>
  );
}
