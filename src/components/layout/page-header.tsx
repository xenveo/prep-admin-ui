import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  breadcrumb,
  statusChip,
  meta,
  leading,
  titleSize = "lg",
  actionsAlign,
  className,
}: {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  statusChip?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  /** lg = 28px page title; md = 26px (record pages such as the role editor). `leading` always implies 26px. */
  titleSize?: "lg" | "md";
  /** Vertical alignment of the actions against the title block. Defaults to centre with `leading`, else bottom. */
  actionsAlign?: "start" | "center" | "end";
  className?: string;
}) {
  const align = actionsAlign ?? (leading ? "center" : "end");
  return (
    <header className={cn("mb-6 flex flex-col gap-6", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[13px] leading-5 text-ink-faint">
            {breadcrumb.map((b, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <li key={`${b.label}-${i}`} className="flex items-center gap-2">
                  {b.href && !last ? (
                    <Link href={b.href} className="rounded-sm text-ink-muted no-underline hover:text-ink">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn(last ? "text-ink" : "text-ink-muted")}>
                      {b.label}
                    </span>
                  )}
                  {!last && <span aria-hidden="true">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div
        className={cn(
          "flex flex-wrap justify-between gap-4",
          align === "start" ? "items-start" : align === "center" ? "items-center" : "items-end",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-5">
          {leading}
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className={cn(
                  "m-0 font-semibold leading-tight tracking-[-0.02em] text-ink",
                  leading || titleSize === "md" ? "text-[26px]" : "text-[28px]",
                )}
              >
                {title}
              </h1>
              {statusChip}
            </div>
            {description && <p className="m-0 text-[15px] leading-[22px] text-ink-muted">{description}</p>}
            {meta && <div className="text-sm text-ink-muted">{meta}</div>}
          </div>
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex flex-none flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
  );
}

/** Centred page column. The app shell adds no padding of its own, so this is the only page gutter. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-6 min-[1025px]:px-10 min-[1025px]:pt-8 min-[1025px]:pb-16", className)}>
      {children}
    </div>
  );
}
