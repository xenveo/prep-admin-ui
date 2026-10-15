"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { ApiError, request } from "@/lib/api/client";
import type { Admin } from "@/lib/types";

const AdminContext = createContext<Admin | null>(null);

export function useAdminSession() { return useContext(AdminContext); }

export async function signOutAdmin() {
  try { await request<void>("/auth/logout", { method: "POST" }); }
  catch (error) { if (!(error instanceof ApiError && (error.status === 401 || (error.status === 403 && error.code === "access_expired")))) throw error; }
  window.location.replace("/login");
}

export function AdminSession({ admin, children }: { admin: Admin; children: ReactNode }) {
  useEffect(() => {
    const expire = () => window.location.replace("/login?reason=expired");
    window.addEventListener("preppilot:access-expired", expire);
    return () => window.removeEventListener("preppilot:access-expired", expire);
  }, []);
  return <AdminContext.Provider value={admin}>{children}</AdminContext.Provider>;
}
