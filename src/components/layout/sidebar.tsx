"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAdmin, useAdminSession } from "@/components/layout/admin-session";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/cn";

export type NavKey = "candidates" | "roles" | "reports" | "settings";

const NAV: { id: NavKey; label: string; href: string; icon: IconName }[] = [
  { id: "candidates", label: "Candidates", href: "/candidates", icon: "users" },
  { id: "roles", label: "Job roles", href: "/roles", icon: "briefcase" },
  { id: "reports", label: "Reports", href: "/reports", icon: "chart" },
  { id: "settings", label: "Settings", href: "/settings/admins", icon: "settings" },
];

/** Expanded: text-only rows. Collapsed: a 40px icon square centred in the 64px rail. */
const itemBase = "focus-inset flex items-center rounded-lg text-sm no-underline";
const itemExpanded = "px-3 py-[9px]";
const itemCollapsed = "size-10 justify-center";
const itemIdle = "font-medium text-ink-muted hover:bg-row-hover hover:text-ink";
const railButton =
  "focus-inset inline-flex size-10 items-center justify-center rounded-lg text-ink-muted hover:bg-row-hover hover:text-ink";

export function Sidebar({
  active,
  collapsed,
  onToggle,
}: {
  active: NavKey | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const admin = useAdminSession();
  const name = admin?.name || admin?.email || "Administrator";
  const access = admin?.access === "super_admin" ? "Super admin" : "Admin";
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logOut() {
    setSigningOut(true);
    try { await signOutAdmin(); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : "Could not log out."); setSigningOut(false); }
  }

  return (
    <nav
      aria-label="Main"
      style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
      className="sticky top-0 flex h-screen flex-none flex-col overflow-y-auto border-r border-line bg-surface-sunken text-sm text-ink"
    >
      <div
        className={cn(
          "flex h-16 flex-none items-center border-b border-line",
          collapsed ? "justify-center" : "px-5",
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-primary text-on-primary"
        >
          <Icon name="logo-mark" size={16} />
        </span>
        {collapsed ? (
          <span className="sr-only">PrepPilot admin</span>
        ) : (
          <>
            <span className="ml-2.5 text-base font-bold tracking-[-0.01em]">PrepPilot</span>
            <span className="ml-auto rounded border border-input-line px-1.5 py-0.5 font-mono text-[10px] leading-[14px] tracking-[0.06em] text-ink-faint">
              ADMIN
            </span>
            <button
              type="button"
              aria-label="Collapse sidebar"
              aria-expanded="true"
              onClick={onToggle}
              className="-mr-2 ml-1 inline-flex size-7 flex-none items-center justify-center rounded-md text-ink-faint hover:bg-row-hover hover:text-ink"
            >
              <Icon name="panel-collapse" size={16} />
            </button>
          </>
        )}
      </div>

      <ul className={cn("m-0 flex list-none flex-col gap-0.5 py-4", collapsed ? "items-center px-0" : "px-3")}>
        {NAV.map((n) => {
          const on = n.id === active;
          const link = (
            <Link
              href={n.href}
              aria-label={collapsed ? n.label : undefined}
              aria-current={on ? "page" : undefined}
              className={cn(
                itemBase,
                collapsed ? itemCollapsed : itemExpanded,
                on ? "bg-primary-soft font-semibold text-ink" : itemIdle,
              )}
            >
              {collapsed ? <Icon name={n.icon} size={18} /> : n.label}
            </Link>
          );
          return (
            <li key={n.id}>
              {collapsed ? (
                <Tooltip content={n.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn("mt-auto flex flex-none flex-col gap-3 border-t border-line py-4", collapsed ? "items-center px-0" : "px-3")}>
        {collapsed ? (
          <Tooltip content="Help" side="right">
            <button type="button" aria-label="Help" className={railButton}>
              <Icon name="help" size={18} />
            </button>
          </Tooltip>
        ) : (
          <button type="button" className={cn(itemBase, itemIdle, "w-full px-3 py-2 text-left")}>
            Help
          </button>
        )}

        <ThemeToggle collapsed={collapsed} />

        {collapsed ? (
          <>
            <span role="img" aria-label={`${name}, ${access}`} title={name} className="mx-auto inline-flex">
              <Avatar name={name} size={32} tone="primary" />
            </span>
            {admin && (
              <Tooltip content={signingOut ? "Logging out…" : "Log out"} side="right">
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void logOut()}
                  aria-label="Log out"
                  className={cn(railButton, "disabled:opacity-50")}
                >
                  <span aria-hidden="true">↪</span>
                </button>
              </Tooltip>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface p-2">
            <Avatar name={name} size={32} tone="primary" />
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <span title={name} className="truncate text-[13px] font-semibold leading-[18px]">{name}</span>
              <span className="truncate text-xs leading-4 text-ink-faint">{access}</span>
            </div>
            {admin && (
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void logOut()}
                className="flex-none rounded-[7px] border border-input-line px-2 py-1.5 text-xs font-semibold leading-4 text-ink-muted hover:border-neutral-line hover:text-ink disabled:opacity-50"
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            )}
          </div>
        )}
        {logoutError && (
          <p role="alert" className={cn("m-0 text-xs text-error", collapsed && "px-2 text-center")}>
            {logoutError}
          </p>
        )}

        {collapsed && (
          <Tooltip content="Expand sidebar" side="right">
            <button
              type="button"
              aria-label="Expand sidebar"
              aria-expanded="false"
              onClick={onToggle}
              className={railButton}
            >
              <Icon name="panel-expand" size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
