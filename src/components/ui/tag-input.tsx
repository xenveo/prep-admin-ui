"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

export function TagInput({
  tags,
  onChange,
  label,
  placeholder,
  inputId,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
  placeholder?: string;
  /** id for the text input, so a visible `<label htmlFor>` outside the component can point at it. */
  inputId?: string;
}) {
  const [draft, setDraft] = useState("");
  const [announce, setAnnounce] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const uid = useId();

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
      setAnnounce(`${t} added`);
    }
    setDraft("");
  };
  const remove = (t: string) => {
    onChange(tags.filter((x) => x !== t));
    setAnnounce(`${t} removed`);
    ref.current?.focus();
  };

  return (
    <div
      role="group"
      aria-label={label}
      onClick={() => ref.current?.focus()}
      className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[9px] border border-input-line bg-surface-sunken p-1.5 transition-colors duration-100 focus-within:border-primary-line focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1.5 rounded-[7px] bg-neutral-soft py-[5px] pr-1.5 pl-2.5 text-[13px] leading-[18px] font-semibold text-ink"
        >
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={(e) => {
              e.stopPropagation();
              remove(t);
            }}
            className="relative inline-flex h-[18px] w-5 cursor-pointer items-center justify-center rounded-sm text-ink-faint transition-colors duration-100 after:absolute after:-inset-1 after:content-[''] hover:text-ink"
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        id={inputId ?? uid}
        aria-label={inputId ? undefined : label}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && draft === "" && tags.length) {
            const last = tags[tags.length - 1];
            onChange(tags.slice(0, -1));
            setAnnounce(`${last} removed`);
          }
        }}
        className="h-[30px] min-w-[180px] flex-1 border-0 bg-transparent px-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
      />
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
