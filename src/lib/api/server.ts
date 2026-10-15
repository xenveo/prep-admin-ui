import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, request } from "@/lib/api/client";
import type { Admin } from "@/lib/types";

type IdentityState = { kind: "authenticated"; admin: Admin } | { kind: "session" | "expired" | "denied" };

export const adminIdentity = cache(async (): Promise<IdentityState> => {
  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const admin = await request<Admin>("/admin/me", { headers: { Cookie: cookie }, cache: "no-store" });
    return { kind: "authenticated", admin };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { kind: "session" };
      if (error.status === 403 && error.code === "access_expired") return { kind: "expired" };
      if (error.status === 404 || error.status === 403) return { kind: "denied" };
    }
    throw error;
  }
});

export async function requireAdmin(): Promise<Admin> {
  const state = await adminIdentity();
  if (state.kind !== "authenticated") redirect(`/login?reason=${state.kind}`);
  return state.admin;
}
