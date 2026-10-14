"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export function DropZone({
  onFile,
  accept = ".csv,text/csv",
  title = "Drop a CSV or browse",
  helper,
  disabled,
}: {
  onFile: (file: File) => void;
  accept?: string;
  title?: string;
  helper?: string;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Title "Drop a CSV or browse": the word "browse" is the real button.
  const m = /^(.*?)\bbrowse\b(.*)$/i.exec(title);
  const browse = (label: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer font-semibold text-primary-text underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border-[1.5px] border-dashed bg-bg px-6 py-8 text-center",
        over ? "border-primary" : "border-input-line",
      )}
    >
      <span className="text-ink-muted">
        <Icon name="upload" size={24} />
      </span>
      <p className="text-sm font-semibold text-ink">
        {m ? (
          <>
            {m[1]}
            {browse("browse")}
            {m[2]}
          </>
        ) : (
          browse(title)
        )}
      </p>
      {helper && <p className="text-xs leading-4 text-ink-muted">{helper}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-label="Choose file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
