"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { signOutAdmin } from "@/components/layout/admin-session";
import { ApiError, request } from "@/lib/api/client";

type CodeResponse = { result: "sent" } | { result: "rate-limited"; retryAfterSec: number };
type VerifyResponse = { result: "ok" | "wrong" | "expired" };

export function LoginScreen({ email: initialEmail, token, reason }: { email?: string; token?: string; reason?: string }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [denied, setDenied] = useState(reason === "denied");
  const [invalidLink, setInvalidLink] = useState(false);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function sendCode() {
    if (pending || remaining > 0) return;
    setPending(true); setError("");
    try {
      const result = await request<CodeResponse>("/auth/code", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      if (result.result === "rate-limited") {
        setRemaining(result.retryAfterSec);
        setNotice("Too many requests. Please wait before trying again.");
      } else if (initialEmail) setNotice("If this email has an invite, a new code is on its way.");
      else router.push(`/login/code?email=${encodeURIComponent(email.trim())}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send a code. Try again."); }
    finally { setPending(false); }
  }

  async function verify() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = verified ? { result: "ok" as const } : await request<VerifyResponse>("/auth/verify", { method: "POST", body: JSON.stringify(token ? { token } : { email, code }) });
      if (result.result !== "ok") {
        if (token) setInvalidLink(true);
        setError(result.result === "wrong" ? "That code does not match. Use the latest email." : "This code or invitation has expired. Request a new login code.");
        return;
      }
      setVerified(true);
      await request("/admin/me", { cache: "no-store" });
      window.location.replace("/candidates");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        setDenied(true);
        setError(error.code === "access_expired" ? "Your access has expired. Contact your workspace administrator." : "This account does not have administrator access. Use your admin email.");
      } else setError(error instanceof Error ? error.message : "Could not check your login. Try again.");
    } finally { setPending(false); }
  }

  return <section className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-line bg-surface p-8 text-ink">
    <div className="flex items-center gap-2 font-bold"><span className="flex size-7 items-center justify-center rounded bg-primary text-on-primary"><Icon name="logo-mark" size={16} /></span>PrepPilot admin</div>
    <div><h1 className="text-xl font-semibold">{token ? "Accept your invitation" : initialEmail ? "Enter your login code" : "Log in to your workspace"}</h1><p className="mt-2 text-sm text-ink-muted">{initialEmail ? `For ${email}` : "Enter the email address your administrator invitation was sent to."}</p></div>
    {reason && <p role="status" className="text-sm text-ink-muted">{reason === "expired" ? "Your access has expired. Contact your workspace administrator." : reason === "denied" ? "This account does not have administrator access." : "Your session has ended. Please log in again."}</p>}
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (initialEmail) void verify(); else void sendCode(); }}>
      {!initialEmail && <label className="flex flex-col gap-2 text-sm font-medium">Email address<Input type="email" autoComplete="email" required value={email} disabled={pending} onChange={(event) => setEmail(event.target.value)} /></label>}
      {initialEmail && !token && <label className="flex flex-col gap-2 text-sm font-medium">6-digit code<Input autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={pending} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {notice && <p role="status" className="text-sm text-ink-muted">{notice}</p>}
      <Button type="submit" variant="primary" disabled={pending || invalidLink || (!initialEmail && remaining > 0)}>{pending ? "Please wait…" : token ? "Continue" : initialEmail ? "Log in" : "Send login code"}</Button>
    </form>
    {remaining > 0 && <p role="status" className="text-sm text-ink-muted">Try again in {remaining} seconds.</p>}
    {initialEmail && !token && <Button variant="text" disabled={pending || remaining > 0} onClick={() => void sendCode()}>Resend code</Button>}
    {initialEmail && <Link href="/login" className="text-sm font-semibold text-primary-text underline">{token ? "Request a login code" : "Use a different email"}</Link>}
    {(denied || reason === "expired") && <Button disabled={pending} onClick={() => { setPending(true); signOutAdmin().catch((error: unknown) => { setError(error instanceof Error ? error.message : "Could not log out."); setPending(false); }); }}>Log out of this account</Button>}
    <p className="text-xs text-ink-muted">Need help? Contact your workspace administrator.</p>
  </section>;
}
