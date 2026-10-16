"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useAsync } from "@/lib/use-async";
import { getCurrentAdmin } from "@/services/settings";
import { SettingsProvider, type HeaderAction } from "./settings-context";
import { SECTIONS, SECTION_GROUPS } from "./sections";
import { ErrorBanner } from "./load-state";
import { settingsErrorMessage } from "./error-copy";

/** Header + grouped 200px subnav shared by every settings section; sections own the primary action. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = SECTIONS.find((s) => pathname === `/settings/${s.key}` || pathname.startsWith(`/settings/${s.key}/`));
  const { data: admin, error, reload } = useAsync(getCurrentAdmin, []);
  const [action, setAction] = useState<HeaderAction | null>(null);
  const ctx = useMemo(() => ({ admin, setAction }), [admin]);
  const isSuper = admin?.access === "super_admin";
  const headerAction = action && action.placement !== "savebar" ? action : null;
  const saveBar = action && action.placement === "savebar" ? action : null;

  return (
    <PageContainer className="!max-w-[1200px]">
      <PageHeader
        title="Settings"
        description={current?.description}
        className="!mb-7"
        primaryAction={
          headerAction ? (
            <Button
              variant="primary"
              iconLeft={headerAction.iconLeft}
              disabledReason={headerAction.disabledReason}
              disabled={headerAction.loading}
              aria-busy={headerAction.loading || undefined}
              onClick={headerAction.onClick}
            >
              {headerAction.label}
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-start gap-8">
        <nav aria-label="Settings sections" className="flex flex-[0_0_200px] flex-col gap-[18px]">
          {SECTION_GROUPS.map((g) => (
            <div key={g.label} role="group" aria-labelledby={`settings-nav-${g.label}`} className="flex flex-col gap-0.5">
              <span
                id={`settings-nav-${g.label}`}
                className="px-3 pb-1.5 font-mono text-[11px] leading-4 tracking-[0.08em] text-ink-faint uppercase"
              >
                {g.label}
              </span>
              {g.sections.map((s) => {
                const on = current?.key === s.key;
                const locked = admin !== undefined && !isSuper && s.superOnly;
                return (
                  <Link
                    key={s.key}
                    href={`/settings/${s.key}`}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "focus-inset flex items-center justify-between gap-2 rounded-lg px-3 py-[9px] text-left text-sm leading-5 no-underline transition-colors duration-100",
                      on
                        ? "bg-primary-soft font-semibold text-ink"
                        : "font-medium text-ink-muted hover:bg-row-hover hover:text-ink",
                    )}
                  >
                    <span>{s.label}</span>
                    {locked && (
                      <span className="inline-flex text-ink-faint" title="Super admins only">
                        <Icon name="lock" size={14} label="Super admins only" />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-5">
          <SettingsProvider value={ctx}>
            {error ? <ErrorBanner message={settingsErrorMessage(error, "Couldn't load settings. Try again.")} onRetry={reload} /> : children}
          </SettingsProvider>
        </div>
      </div>
      {saveBar && (
        <div className="pointer-events-none sticky bottom-5 z-30 mt-6 flex justify-center">
          <div
            role="region"
            aria-label="Unsaved changes"
            className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-card border border-neutral-line bg-selected py-2.5 pr-2.5 pl-[18px] shadow-[var(--shadow-menu)]"
          >
            <span className="text-sm leading-5 text-ink">{saveBar.loading ? "Saving your changes" : "You have unsaved changes"}</span>
            {saveBar.onDiscard && (
              <Button variant="ghost" className="!h-9 !px-2" disabled={saveBar.loading} onClick={saveBar.onDiscard}>
                Discard
              </Button>
            )}
            <Button
              variant="primary"
              className="!h-9 !rounded-[9px]"
              disabledReason={saveBar.disabledReason}
              disabled={saveBar.loading}
              aria-busy={saveBar.loading || undefined}
              onClick={saveBar.onClick}
            >
              {saveBar.label}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
