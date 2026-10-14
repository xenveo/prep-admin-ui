import type { RoleChoice } from "@/components/ui/role-checklist";
import type { JobRole } from "@/lib/types";

/** Approved and draft roles as checklist rows; archived roles are hidden. */
export function toRoleChoices(roles: JobRole[], excludeIds: string[] = []): RoleChoice[] {
  return roles
    .filter((r) => r.status !== "archived" && !excludeIds.includes(r.id))
    .sort((a, b) => Number(a.status === "draft") - Number(b.status === "draft"))
    .map((r) =>
      r.status === "approved"
        ? { id: r.id, title: r.title, meta: `${r.flashCardCount} cards · ${r.questionCount} questions`, status: "approved" as const }
        : { id: r.id, title: r.title, meta: "", status: "draft" as const, approveHref: `/roles/${r.id}/details` },
    );
}
