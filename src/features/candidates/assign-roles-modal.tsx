"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RoleChecklist } from "@/components/ui/role-checklist";
import { useAsync } from "@/lib/use-async";
import { pluralize } from "@/lib/format";
import { assignRoles } from "@/services/candidates";
import { listRoles } from "@/services/roles";
import { toRoleChoices } from "./role-choices";

/** Small modal to add roles to one or more candidates. Mount it only while open. */
export function AssignRolesModal({
  candidateIds,
  /** Role ids to hide (already assigned, single-candidate case). */
  excludeRoleIds = [],
  subject,
  onClose,
  onAssigned,
}: {
  candidateIds: string[];
  excludeRoleIds?: string[];
  /** "Priya Sharma" or "2 candidates" */
  subject: string;
  onClose: () => void;
  onAssigned: (added: number, roleCount: number) => void;
}) {
  const { data: roles, error, loading, reload } = useAsync(() => listRoles(), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const choices = roles ? toRoleChoices(roles, excludeRoleIds) : [];

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      const { added } = await assignRoles(candidateIds, selected);
      onAssigned(added, selected.length);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign roles"
      width={520}
      footerNote={selected.length > 0 ? `${pluralize(selected.length, "role")} selected` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy}
            disabledReason={selected.length === 0 ? "Pick at least one role" : undefined}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-ink-muted">
          Choose roles for {subject}. Candidates see only approved roles.
        </p>
        {loading && !roles && <p className="m-0 text-sm text-ink-muted">Loading roles…</p>}
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-error">
            Couldn’t load roles.{" "}
            <button type="button" onClick={reload} className="font-semibold underline">
              Try again
            </button>
          </p>
        )}
        {roles && choices.length === 0 && (
          <p className="m-0 text-sm text-ink-muted">All available roles are already assigned.</p>
        )}
        {roles && choices.length > 0 && (
          <RoleChecklist roles={choices} selectedIds={selected} onChange={setSelected} label="Roles to assign" />
        )}
        {failed && (
          <p role="alert" className="m-0 text-sm font-medium text-error">
            Couldn’t assign roles. Try again.
          </p>
        )}
      </div>
    </Modal>
  );
}
