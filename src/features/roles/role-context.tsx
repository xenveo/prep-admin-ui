"use client";

import { createContext, useContext } from "react";
import type { JobRole } from "@/lib/types";

const RoleContext = createContext<JobRole | null>(null);

export const RoleProvider = RoleContext.Provider;

/** The role being edited. Only valid under the role editor layout, which renders children once the role has loaded. */
export function useRole(): JobRole {
  const role = useContext(RoleContext);
  if (!role) throw new Error("useRole must be used inside the role editor layout");
  return role;
}
