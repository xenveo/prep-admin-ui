/** Placeholder body used by routes that a later wave fills in. */
export function ComingSoon({ children = "This screen is coming soon." }: { children?: string }) {
  return (
    <div className="rounded-panel border border-dashed border-neutral-line bg-surface px-6 py-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  );
}
