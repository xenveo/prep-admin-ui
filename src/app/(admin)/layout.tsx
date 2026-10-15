import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSession } from "@/components/layout/admin-session";
import { requireAdmin } from "@/lib/api/server";

async function ProtectedAdmin({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return <AdminSession admin={admin}><AppShell>{children}</AppShell></AdminSession>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-bg" aria-busy="true" />}><ProtectedAdmin>{children}</ProtectedAdmin></Suspense>;
}
