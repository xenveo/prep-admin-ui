import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SettingsCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-1 rounded-md border border-line bg-surface p-5", className)}>
      <h2 className="m-0 mb-2 text-base font-semibold leading-6 text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Label column (260px) + control column, separated by a hairline. */
export function SettingRow({
  label,
  labelId,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  const text = (
    <>
      <span className="font-semibold text-ink">{label}</span>
      {hint && <span className="text-xs leading-4 text-ink-muted">{hint}</span>}
    </>
  );
  return (
    <div className="grid grid-cols-1 items-center gap-2 border-t border-line py-3 min-[720px]:grid-cols-[260px_minmax(0,1fr)] min-[720px]:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} id={labelId} className="flex flex-col">
          {text}
        </label>
      ) : (
        <span id={labelId} className="flex flex-col">
          {text}
        </span>
      )}
      {children}
    </div>
  );
}
