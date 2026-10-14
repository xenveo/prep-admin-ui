import type { ReactNode } from "react";

export function SheetSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`cs-${id}`} className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 id={`cs-${id}`} className="m-0 text-base font-semibold leading-6 text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      <span className="text-xs font-semibold leading-4 text-ink-muted">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
