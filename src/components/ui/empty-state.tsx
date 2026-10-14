import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export function EmptyState({
  icon,
  title,
  description,
  action,
  helper,
  className,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-text">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="m-0 text-base font-semibold leading-6 text-ink">{title}</h3>
      {description ? <p className="m-0 max-w-[420px] text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
      {helper ? <p className="m-0 mt-1 text-xs leading-4 text-ink-muted">{helper}</p> : null}
    </div>
  );
}
