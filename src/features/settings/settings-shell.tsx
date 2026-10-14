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
import { SECTIONS } from "./sections";

/** Header + 200px subnav shared by every settings section; sections own the header's primary button. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = SECTIONS.find((s) => pathname === `/settings/${s.key}` || pathname.startsWith(`/settings/${s.key}/`));
  const { data: admin } = useAsync(getCurrentAdmin, []);
  const [action, setAction] = useState<HeaderAction | null>(null);
  const ctx = useMemo(() => ({ admin, setAction }), [admin]);
  const isSuper = admin?.access === "super_admin";

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description={current?.description}
        primaryAction={
          action ? (
            <Button
              variant="primary"
              iconLeft={action.iconLeft}
              disabledReason={action.disabledReason}
              disabled={action.loading}
              aria-busy={action.loading || undefined}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-start gap-6">
        <nav aria-label="Settings sections" className="flex w-[200px] flex-none flex-col gap-0.5">
          {SECTIONS.map((s) => {
            const on = current?.key === s.key;
            const locked = admin !== undefined && !isSuper && s.superOnly;
            return (
              <Link
                key={s.key}
                href={`/settings/${s.key}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-between rounded-md px-3 text-sm",
                  on ? "bg-primary-soft font-semibold text-primary-text" : "font-medium text-ink hover:bg-neutral-soft",
                )}
              >
                <span>{s.label}</span>
                {locked && (
                  <span className="inline-flex text-ink-muted" title="Super admins only">
                    <Icon name="lock" size={14} label="Super admins only" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4">
          <SettingsProvider value={ctx}>{children}</SettingsProvider>
        </div>
      </div>
    </PageContainer>
  );
}
