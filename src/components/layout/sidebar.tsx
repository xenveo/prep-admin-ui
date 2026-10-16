"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAdmin, useAdminSession } from "@/components/layout/admin-session";
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

const itemBase =
  "focus-inset flex h-9 items-center gap-2.5 rounded-md px-2.5 no-underline";

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
  const initials = name.split(/[ @._-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const access = admin?.access === "super_admin" ? "Super admin" : "Admin";
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logOut() {
    setSigningOut(true);
    try { await signOutAdmin(); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : "Could not log out."); setSigningOut(false); }
  }
  const justify = collapsed ? "justify-center" : "justify-start";

  return (
    <nav
      aria-label="Main"
      style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
      className="sticky top-0 flex h-screen flex-none flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-4 text-sm text-ink"
    >
      <div className={cn("flex h-9 items-center gap-2", collapsed ? "justify-center" : "justify-between px-2")}>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 flex-none items-center justify-center rounded-sm bg-primary text-on-primary">
            <Icon name="logo-mark" size={14} />
          </span>
          {!collapsed && <span className="text-base font-bold">PrepPilot</span>}
          {!collapsed && <span className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-ink-muted">ADMIN</span>}
        </div>
        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-expanded="true"
            onClick={onToggle}
            className="inline-flex size-7 items-center justify-center rounded-sm text-ink-muted hover:bg-neutral-soft"
          >
            <Icon name="panel-collapse" size={16} />
          </button>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {NAV.map((n) => {
          const on = n.id === active;
          const link = (
            <Link
              href={n.href}
              aria-label={collapsed ? n.label : undefined}
              aria-current={on ? "page" : undefined}
              className={cn(
                itemBase,
                justify,
                on
                  ? "bg-primary-soft font-semibold text-primary-text"
                  : "font-medium text-ink hover:bg-neutral-soft",
              )}
            >
              <Icon name={n.icon} size={18} />
              {!collapsed && <span>{n.label}</span>}
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

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        {collapsed ? (
          <Tooltip content="Help" side="right">
            <button
              type="button"
              aria-label="Help"
              className={cn(itemBase, justify, "w-full font-medium text-ink hover:bg-neutral-soft")}
            >
              <Icon name="help" size={18} />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            className={cn(itemBase, justify, "w-full text-left font-medium text-ink hover:bg-neutral-soft")}
          >
            <Icon name="help" size={18} />
            <span>Help</span>
          </button>
        )}

        <ThemeToggle collapsed={collapsed} className={collapsed ? undefined : "mx-2.5 my-1"} />

        <div className={cn("flex items-center gap-2.5 rounded-lg py-2", collapsed ? "justify-center" : "border border-line bg-bg px-2")}>
          <span
            title={name}
            aria-hidden={collapsed ? undefined : true}
            aria-label={collapsed ? `${name}, ${access}` : undefined}
            role={collapsed ? "img" : undefined}
            className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text"
          >
            {initials}
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold leading-5">{name}</span>
              <span className="truncate text-xs leading-4 text-ink-muted">{access}</span>
            </div>
          )}
        </div>

        {admin && <button type="button" disabled={signingOut} onClick={() => void logOut()} aria-label="Log out" className={cn(itemBase, justify, "text-ink-muted hover:bg-neutral-soft disabled:opacity-50")}>{collapsed ? "↪" : signingOut ? "Logging out…" : "Log out"}</button>}
        {logoutError && <p role="alert" className="text-xs text-error">{logoutError}</p>}
        {collapsed && (
          <Tooltip content="Expand sidebar" side="right">
            <button
              type="button"
              aria-label="Expand sidebar"
              aria-expanded="false"
              onClick={onToggle}
              className="inline-flex h-8 w-10 items-center justify-center self-center rounded-sm text-ink-muted hover:bg-neutral-soft"
            >
              <Icon name="panel-expand" size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
