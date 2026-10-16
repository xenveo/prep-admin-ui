"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MenuItem } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { invitedLabel, relativeTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import type { Admin, AdminAccess } from "@/lib/types";
import { changeAdminAccess, inviteAdmin, listAdmins, removeAdmin, resendAdminInvite } from "@/services/settings";
import { ErrorBanner } from "./load-state";
import { settingsErrorMessage } from "./error-copy";
import { useHeaderAction } from "./settings-context";

const ACCESS_LABEL: Record<AdminAccess, string> = { admin: "Admin", super_admin: "Super admin" };
const ACCESS_OPTIONS: { value: AdminAccess; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];

function displayName(a: Admin): string {
  return a.name ?? a.email;
}

export function AdminsSection({ currentAdminId }: { currentAdminId: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(listAdmins, []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<Admin | null>(null);
  const [removeFor, setRemoveFor] = useState<Admin | null>(null);
  const [mutating, setMutating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inviteReturn = useRef<HTMLElement | null>(null);

  useHeaderAction({
    label: "Invite admin",
    iconLeft: "plus",
    loading: mutating,
    onClick: () => {
      inviteReturn.current = document.activeElement as HTMLElement | null;
      setInviteOpen(true);
    },
  });

  const columns: Column<Admin>[] = [
    {
      id: "name",
      header: "Name",
      render: (a) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={displayName(a)} size={28} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold leading-[18px]">
              {displayName(a)}
              {a.id === currentAdminId && " (you)"}
            </span>
            <span className="truncate text-xs leading-4 text-ink-muted">
              {a.status === "invite_pending" && a.invitedAt ? invitedLabel(a.invitedAt) : a.email}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "access",
      header: "Access",
      render: (a) => (
        <span className="inline-flex items-center gap-2">
          <span>{ACCESS_LABEL[a.access]}</span>
          {a.status === "invite_pending" && <StatusChip status="invite-pending" />}
        </span>
      ),
    },
    {
      id: "last",
      header: "Last active",
      render: (a) =>
        a.lastActiveAt ? <span>{relativeTime(a.lastActiveAt)}</span> : <span className="text-ink-muted">Not yet</span>,
    },
  ];

  function rowActions(a: Admin): MenuItem[] {
    const self = a.id === currentAdminId;
    return [
      { id: "access", label: "Change access", disabled: self || mutating, disabledReason: self ? "You can’t change your own access" : undefined, onSelect: () => setAccessFor(a) },
      {
        id: "resend",
        label: "Resend invite",
        disabled: mutating || a.status !== "invite_pending",
        disabledReason: a.status !== "invite_pending" ? "Already active" : undefined,
        onSelect: () => {
          setProblem(null);
          setMutating(true);
          resendAdminInvite(a.id).then(
            () => { toast.show({ title: `Invite resent to ${a.email}` }); reload(); },
            (e: unknown) => setProblem(settingsErrorMessage(e, "Couldn't resend the invite.")),
          ).finally(() => setMutating(false));
        },
      },
      {
        id: "remove",
        label: "Remove admin",
        destructive: true,
        dividerBefore: true,
        disabled: self || mutating,
        disabledReason: self ? "You can't remove yourself" : undefined,
        onSelect: () => setRemoveFor(a),
      },
    ];
  }

  async function confirmRemove() {
    const a = removeFor;
    if (!a || mutating) return;
    setRemoveFor(null);
    setProblem(null);
    setMutating(true);
    try {
      await removeAdmin(a.id);
      toast.show({ title: `Removed ${displayName(a)}` });
      reload();
    } catch (e) {
      setProblem(settingsErrorMessage(e, "Couldn't remove this admin."));
    } finally { setMutating(false); }
  }

  return (
    <>
      {(error || problem) && (
        <ErrorBanner message={problem ?? "Couldn't load admins. Try again."} onRetry={problem ? undefined : reload} />
      )}
      <section aria-labelledby="ad-h" className="rounded-md border border-line bg-surface">
        <div className="px-5 pt-4 pb-3">
          <h2 id="ad-h" className="m-0 text-base font-semibold leading-6">
            Admins
          </h2>
          <p className="m-0 text-xs leading-4 text-ink-muted">Super admins also manage admins, data and privacy, and email settings.</p>
        </div>
        <DataTable
          ariaLabel="Admins"
          columns={columns}
          rows={data ?? []}
          rowId={(a) => a.id}
          loading={loading && !data}
          rowActions={rowActions}
          twoLine
        />
      </section>

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        returnFocusRef={inviteReturn}
        onInvited={(a) => {
          setInviteOpen(false);
          toast.show({ title: `Invite sent to ${a.email}` });
          reload();
        }}
      />
      <ChangeAccessModal
        admin={accessFor}
        onClose={() => setAccessFor(null)}
        onChanged={(a, access) => {
          setAccessFor(null);
          toast.show({ title: `${displayName(a)} is now ${ACCESS_LABEL[access]}` });
          reload();
        }}
      />
      <ConfirmDialog
        open={removeFor !== null}
        tone="destructive"
        title={removeFor ? `Remove ${displayName(removeFor)}?` : ""}
        body={
          removeFor?.status === "invite_pending"
            ? "The invite stops working. You can invite them again later."
            : "They can no longer log in to this console. Their past changes stay in the audit log. You can invite them again later."
        }
        confirmLabel="Remove admin"
        onCancel={() => setRemoveFor(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

function InviteAdminModal({
  open,
  onClose,
  onInvited,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (a: Admin) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AdminAccess>("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setEmail("");
    setAccess("admin");
    setError(null);
    onClose();
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await inviteAdmin({ email, access });
      setEmail("");
      setAccess("admin");
      onInvited(a);
    } catch (e) {
      setError(settingsErrorMessage(e, "Couldn't send the invite."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite admin"
      width={480}
      returnFocusRef={returnFocusRef}
      initialFocusRef={emailRef}
      footerNote="They get an email with a link to log in"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            disabledReason={email.trim() === "" ? "Enter an email address" : undefined}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Send invite"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim() !== "") void submit();
        }}
      >
        <Field label="Email" error={error}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={emailRef}
              id={id}
              type="email"
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] leading-5 font-semibold text-ink">Access</span>
          <div className="self-start">
            <SegmentedControl<AdminAccess> label="Access" options={ACCESS_OPTIONS} value={access} onChange={setAccess} />
          </div>
          <p className="m-0 text-xs leading-4 text-ink-muted">Super admins also manage admins, data and privacy, and email settings.</p>
        </div>
      </form>
    </Modal>
  );
}

function ChangeAccessModal({
  admin,
  onClose,
  onChanged,
}: {
  admin: Admin | null;
  onClose: () => void;
  onChanged: (a: Admin, access: AdminAccess) => void;
}) {
  const [picked, setPicked] = useState<AdminAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const access = picked ?? admin?.access ?? "admin";

  function close() {
    setPicked(null);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!admin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await changeAdminAccess(admin.id, access);
      const a = admin;
      setPicked(null);
      onChanged(a, access);
    } catch (e) {
      setError(settingsErrorMessage(e, "Couldn't change access."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={admin !== null}
      onClose={close}
      title={admin ? `Change access for ${displayName(admin)}` : "Change access"}
      width={480}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            disabledReason={admin && access === admin.access ? "Pick a different access level" : undefined}
            onClick={() => void submit()}
          >
            Save access
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <SegmentedControl<AdminAccess> label="Access" options={ACCESS_OPTIONS} value={access} onChange={setPicked} />
        <p className="m-0 text-xs leading-4 text-ink-muted">Super admins also manage admins, data and privacy, and email settings.</p>
        {error && (
          <p role="alert" className="m-0 text-xs leading-4 font-medium text-improve-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
