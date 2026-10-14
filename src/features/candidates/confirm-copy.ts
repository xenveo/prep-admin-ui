import { firstName, pluralize } from "@/lib/format";
import type { CandidateStatus } from "@/lib/types";

export type ConfirmState =
  | { kind: "deactivate"; id: string; name: string; sessions: number }
  | { kind: "revoke"; id: string; name: string }
  | {
      kind: "remove-role";
      candidateId: string;
      name: string;
      roleId: string;
      roleTitle: string;
      sessionsUsed: number;
      draft: boolean;
    }
  | { kind: "bulk-deactivate"; rows: { id: string; name: string; status: CandidateStatus }[] };

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 4) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} others`;
}

export function confirmCopy(c: ConfirmState): { title: string; body: string; confirmLabel: string } {
  switch (c.kind) {
    case "deactivate":
      return {
        title: `Deactivate ${c.name}?`,
        body: `${firstName(c.name)} won’t be able to log in or start sessions. Their ${pluralize(c.sessions, "session")}, scores and transcripts are kept, and you can reactivate them later.`,
        confirmLabel: "Deactivate",
      };
    case "revoke":
      return {
        title: `Revoke ${c.name}’s invite?`,
        body: `The login link in ${firstName(c.name)}’s email stops working and they won’t be able to sign in. Nothing else changes, and you can invite them again later.`,
        confirmLabel: "Revoke invite",
      };
    case "remove-role":
      return {
        title: `Remove ${c.roleTitle} from ${c.name}?`,
        body: c.draft
          ? `${firstName(c.name)} will no longer be assigned this role and will not see it when it is approved. The invite stays active.`
          : `${firstName(c.name)} loses access to this role’s flash cards and mock interviews. Their ${c.sessionsUsed} past ${c.sessionsUsed === 1 ? "session stays" : "sessions stay"} in reports, and you can assign the role again later.`,
        confirmLabel: "Remove role",
      };
    case "bulk-deactivate": {
      const pending = c.rows.filter((r) => r.status === "invite_pending").length;
      const names = joinNames(c.rows.map((r) => r.name));
      const pendingNote = pending
        ? ` ${pluralize(pending, "pending invite")} ${pending === 1 ? "is" : "are"} revoked.`
        : "";
      return {
        title: `Deactivate ${c.rows.length === 1 ? "1 candidate" : `${c.rows.length} candidates`}?`,
        body: `${names} won’t be able to log in or start sessions.${pendingNote} Sessions and scores are kept, and you can reactivate them later.`,
        confirmLabel: `Deactivate ${c.rows.length}`,
      };
    }
  }
}
