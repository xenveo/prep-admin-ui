"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TableAlt = { caption: string; columns: string[]; rows: (string | number)[][] };

/** Wraps a chart with title/caption and a "Show as table" toggle that swaps in a real table. */
export function ChartFrame({
  title,
  caption,
  table,
  children,
  className,
  toggleLabel = "Show as table",
  chartLabel = "Show as chart",
  hideToggle = false,
}: {
  title?: ReactNode;
  caption?: ReactNode;
  table: TableAlt;
  children: ReactNode;
  className?: string;
  toggleLabel?: string;
  /** Toggle label while the table is showing. */
  chartLabel?: string;
  /** Hide the built-in table toggle when the consumer renders its own. */
  hideToggle?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const regionId = useId();
  const hasHead = Boolean(title || caption || !hideToggle);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hasHead && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="m-0 text-base font-semibold leading-6 text-ink">{title}</h3> : null}
            {caption ? <p className="m-0 text-xs leading-4 text-ink-faint">{caption}</p> : null}
          </div>
          {!hideToggle && (
            <button
              type="button"
              aria-controls={regionId}
              onClick={() => setAsTable((v) => !v)}
              className="shrink-0 cursor-pointer rounded-sm text-[13px] font-semibold leading-5 text-ink-muted hover:text-ink"
            >
              {asTable ? chartLabel : toggleLabel}
            </button>
          )}
        </div>
      )}
      <div id={regionId}>
        {asTable && !hideToggle ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px] text-ink">
              <caption className="pb-2 text-left text-xs text-ink-faint">{table.caption}</caption>
              <thead>
                <tr>
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn(
                        "h-9 border-b border-line px-3 text-xs font-semibold text-ink-faint first:pl-0 last:pr-0",
                        i > 0 && typeof table.rows[0]?.[i] === "number" && "text-right",
                      )}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) =>
                      ci === 0 ? (
                        <th key={ci} scope="row" className="h-9 border-b border-line px-3 pl-0 font-normal text-ink-muted">
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={ci}
                          className={cn(
                            "h-9 border-b border-line px-3 last:pr-0",
                            typeof cell === "number" && "text-right font-semibold",
                          )}
                        >
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
