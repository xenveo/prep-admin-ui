"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

const ALLOWED = new Set(["b", "strong", "i", "em", "ul", "ol", "li", "p", "br", "a"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript"]);
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;");
}

function serialize(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += esc(child.textContent ?? "");
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    let tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return;
    if (tag === "div") tag = "p";
    if (!ALLOWED.has(tag)) {
      out += serialize(el);
      return;
    }
    if (tag === "br") {
      out += "<br>";
      return;
    }
    const inner = serialize(el);
    if (tag === "a") {
      const href = (el.getAttribute("href") ?? "").trim();
      out += SAFE_HREF.test(href) ? `<a href="${escAttr(href)}" rel="noopener noreferrer">${inner}</a>` : inner;
      return;
    }
    out += `<${tag}>${inner}</${tag}>`;
  });
  return out;
}

/** Allow only b, strong, i, em, ul, ol, li, p, br and a[href http(s)/mailto]. Browser only. */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return serialize(doc.body);
}

type Cmd = { id: string; label: string; icon: IconName; command: string };
const COMMANDS: Cmd[] = [
  { id: "bold", label: "Bold", icon: "bold", command: "bold" },
  { id: "italic", label: "Italic", icon: "italic", command: "italic" },
  { id: "ul", label: "Bulleted list", icon: "list-bullet", command: "insertUnorderedList" },
  { id: "ol", label: "Numbered list", icon: "list-number", command: "insertOrderedList" },
];

export function RichTextEditor({
  value,
  onChange,
  label,
  helper,
  minHeight = 168,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  helper?: ReactNodeLike;
  minHeight?: number;
}) {
  const uid = useId();
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState(false);

  // Push external value into the DOM only when it differs from what we last emitted.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === lastEmitted.current) return;
    el.innerHTML = sanitizeHtml(value);
    lastEmitted.current = value;
  }, [value]);

  const refreshState = useCallback(() => {
    const el = ref.current;
    const sel = document.getSelection();
    if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    const next: Record<string, boolean> = {};
    for (const c of COMMANDS) {
      try {
        next[c.id] = document.queryCommandState(c.command);
      } catch {
        next[c.id] = false;
      }
    }
    const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? (sel.anchorNode as Element) : sel.anchorNode.parentElement;
    next.link = Boolean(node?.closest("a"));
    setActive(next);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    lastEmitted.current = clean;
    onChange(clean);
  };

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
    refreshState();
  };

  const openLink = () => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setLinkUrl("https://");
    setLinkError(false);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!SAFE_HREF.test(url)) {
      setLinkError(true);
      return;
    }
    const el = ref.current;
    el?.focus();
    const sel = document.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (sel && sel.isCollapsed) document.execCommand("insertHTML", false, `<a href="${escAttr(url)}">${esc(url)}</a>`);
    else document.execCommand("createLink", false, url);
    setLinkOpen(false);
    emit();
  };

  const helperId = `${uid}-helper`;
  const btn =
    "focus-inset inline-flex h-7 w-[30px] cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-100 hover:bg-row-hover hover:text-ink aria-pressed:bg-primary-soft aria-pressed:text-primary-text";

  return (
    <div className="flex flex-col gap-2">
      <span id={`${uid}-label`} className="text-sm leading-5 font-semibold text-ink">
        {label}
      </span>
      <div className="overflow-hidden rounded-[9px] border border-input-line bg-surface-sunken transition-colors duration-100 focus-within:border-primary-line focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
        <div role="toolbar" aria-label={`${label} formatting`} className="flex items-center gap-0.5 border-b border-line p-1.5">
          {COMMANDS.map((c) => (
            <button key={c.id} type="button" aria-label={c.label} aria-pressed={!!active[c.id]} onMouseDown={(e) => e.preventDefault()} onClick={() => run(c.command)} className={btn}>
              <Icon name={c.icon} size={16} />
            </button>
          ))}
          <button type="button" aria-label="Link" aria-pressed={!!active.link || linkOpen} onMouseDown={(e) => e.preventDefault()} onClick={() => (linkOpen ? setLinkOpen(false) : openLink())} className={btn}>
            <Icon name="link" size={16} />
          </button>
        </div>
        {linkOpen && (
          <form
            className="flex items-center gap-2 border-b border-line p-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setLinkOpen(false);
                ref.current?.focus();
              }
            }}
          >
            <input
              autoFocus
              type="url"
              aria-label="Link address"
              aria-invalid={linkError || undefined}
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError(false);
              }}
              className={cn("h-8 flex-1 rounded-md border bg-surface px-2 text-[13px] text-ink", linkError ? "border-improve" : "border-input-line")}
            />
            <button type="submit" className="h-8 cursor-pointer rounded-md border border-input-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-neutral-line">
              Apply
            </button>
            {linkError && <span role="alert" className="text-xs font-medium text-improve-text">Use an http, https or mailto address.</span>}
          </form>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${uid}-label`}
          aria-describedby={helper ? helperId : undefined}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            e.preventDefault();
            const html = e.clipboardData.getData("text/html");
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertHTML", false, html ? sanitizeHtml(html) : esc(text).replace(/\n/g, "<br>"));
          }}
          style={{ minHeight }}
          className="p-3 text-[15px] leading-[1.6] text-ink outline-none [&_a]:text-primary-text [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      {helper && (
        <p id={helperId} className="m-0 text-[13px] leading-[18px] text-ink-faint">
          {helper}
        </p>
      )}
    </div>
  );
}

type ReactNodeLike = React.ReactNode;
