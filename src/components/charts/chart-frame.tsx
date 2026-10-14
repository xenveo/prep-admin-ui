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
}: {
  title?: ReactNode;
  caption?: ReactNode;
  table: TableAlt;
  children: ReactNode;
  className?: string;
  toggleLabel?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const regionId = useId();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <h3 className="m-0 text-[16px] font-semibold leading-6 text-ink">{title}</h3> : null}
          {caption ? <p className="m-0 text-[12px] leading-4 text-ink-muted">{caption}</p> : null}
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          aria-controls={regionId}
          onClick={() => setAsTable((v) => !v)}
          className={cn(
            "inline-flex h-[30px] shrink-0 cursor-pointer items-center rounded-md border px-2.5 text-[13px] font-medium text-ink",
            asTable ? "border-primary bg-primary-tint" : "border-line bg-surface",
          )}
        >
          {toggleLabel}
        </button>
      </div>
      <div id={regionId}>
        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px] text-ink">
              <caption className="pb-2 text-left text-[12px] text-ink-muted">{table.caption}</caption>
              <thead>
                <tr>
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn(
                        "h-9 border-b border-line px-3 text-[12px] font-semibold text-ink-muted",
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
                        <th key={ci} scope="row" className="h-9 border-b border-line px-3 font-medium">
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={ci}
                          className={cn(
                            "h-9 border-b border-line px-3",
                            typeof cell === "number" && "text-right",
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
