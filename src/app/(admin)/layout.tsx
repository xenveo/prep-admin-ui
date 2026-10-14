import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // AppShell reads the pathname; on routes with runtime params that needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" aria-busy="true" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
