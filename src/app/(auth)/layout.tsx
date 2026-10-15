import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { adminIdentity } from "@/lib/api/server";

async function AuthGate({ children }: { children: ReactNode }) {
  const state = await adminIdentity();
  if (state.kind === "authenticated") redirect("/candidates");
  return children;
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12"><Suspense fallback={<p role="status">Checking session…</p>}><AuthGate>{children}</AuthGate></Suspense></main>;
}
