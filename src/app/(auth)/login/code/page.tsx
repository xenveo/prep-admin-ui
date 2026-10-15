import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/features/auth/login-screen";

type Params = { email?: string; token?: string };
async function Code({ searchParams }: { searchParams: Promise<Params> }) {
  const { email, token } = await searchParams;
  if (!email) redirect("/login");
  return <LoginScreen email={email} token={token} />;
}
export default function CodePage(props: { searchParams: Promise<Params> }) {
  return <Suspense fallback={<p role="status">Loading login…</p>}><Code {...props} /></Suspense>;
}
