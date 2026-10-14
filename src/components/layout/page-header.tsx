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
}: {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  statusChip?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-xs text-ink-muted">
            {breadcrumb.map((b, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <li key={`${b.label}-${i}`} className="flex items-center gap-1.5">
                  {b.href && !last ? (
                    <Link href={b.href} className="rounded-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                      {b.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn(last && "text-ink")}>
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
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-xl font-semibold leading-7 text-ink">{title}</h1>
              {statusChip}
            </div>
            {description && <p className="m-0 text-sm text-ink-muted">{description}</p>}
            {meta && <div className="mt-1 text-sm text-ink-muted">{meta}</div>}
          </div>
        </div>
        {(secondaryActions || primaryAction) && (
          <div className="flex flex-none items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-6 min-[1025px]:px-8", className)}>{children}</div>;
}
