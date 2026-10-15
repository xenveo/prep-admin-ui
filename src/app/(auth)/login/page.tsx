import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/login-screen";

async function Login({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <LoginScreen reason={reason} />;
}
export default function LoginPage(props: { searchParams: Promise<{ reason?: string }> }) {
  return <Suspense fallback={<p role="status">Loading login…</p>}><Login {...props} /></Suspense>;
}
