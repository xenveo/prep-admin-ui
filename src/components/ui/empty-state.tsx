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
    <div className={cn("flex flex-col items-center gap-2 px-6 py-14 text-center", className)}>
      <span className="mb-2 inline-flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary-text">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="m-0 text-[15px] leading-6 font-semibold text-ink">{title}</h3>
      {description ? <p className="m-0 max-w-[420px] text-sm leading-[1.5] text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
      {helper ? <p className="m-0 mt-1 text-xs leading-4 text-ink-faint">{helper}</p> : null}
    </div>
  );
}
