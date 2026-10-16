import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Settings card: 17px title, optional 13px description and right-aligned actions.
 * Rows inside bleed to the card edges so their hairlines run full width.
 */
export function SettingsCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-1 rounded-panel border border-line bg-surface px-[22px] py-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-[17px] font-semibold leading-6 text-ink">{title}</h2>
          {description && <p className="m-0 text-[13px] leading-5 text-ink-faint">{description}</p>}
        </div>
        {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Label column (up to 260px) + control column, separated by a full-width hairline. */
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
      <span className="text-sm font-semibold leading-5 text-ink">{label}</span>
      {hint && <span className="text-[13px] leading-[18px] text-ink-faint">{hint}</span>}
    </>
  );
  return (
    <div className="-mx-[22px] grid grid-cols-1 items-center gap-2 border-t border-line px-[22px] py-[18px] min-[720px]:grid-cols-[minmax(180px,260px)_minmax(0,1fr)] min-[720px]:gap-x-6 min-[720px]:gap-y-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} id={labelId} className="flex flex-col gap-[3px]">
          {text}
        </label>
      ) : (
        <span id={labelId} className="flex flex-col gap-[3px]">
          {text}
        </span>
      )}
      {children}
    </div>
  );
}
