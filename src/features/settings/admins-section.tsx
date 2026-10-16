"use client";

import { useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { invitedLabel, relativeTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import type { Admin, AdminAccess } from "@/lib/types";
import { changeAdminAccess, inviteAdmin, listAdmins, removeAdmin, resendAdminInvite } from "@/services/settings";
import { ErrorBanner } from "./load-state";
import { settingsErrorMessage } from "./error-copy";

const ACCESS_LABEL: Record<AdminAccess, string> = { admin: "Admin", super_admin: "Super admin" };
const ACCESS_OPTIONS: { value: AdminAccess; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super admin" },
];
const EMAIL_RE = /^\S+@\S+\.\S+$/;
/** Name · Access · Last active · actions. */
const COLS = "grid grid-cols-[minmax(0,1fr)_auto_30px] gap-4 min-[720px]:grid-cols-[minmax(220px,2fr)_130px_130px_30px]";

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
  const inviteButton = useRef<HTMLButtonElement>(null);
  const formId = useId();

  function closeInvite() {
    setInviteOpen(false);
    requestAnimationFrame(() => inviteButton.current?.focus());
  }

  function rowActions(a: Admin): MenuItem[] {
    const pending = a.status === "invite_pending";
    const items: MenuItem[] = [
      {
        id: "access",
        label: a.access === "admin" ? "Make super admin" : "Change to admin",
        disabled: mutating,
        onSelect: () => setAccessFor(a),
      },
    ];
    if (pending) {
      items.push({
        id: "resend",
        label: "Resend invite",
        disabled: mutating,
        onSelect: () => {
          setProblem(null);
          setMutating(true);
          resendAdminInvite(a.id)
            .then(
              () => {
                toast.show({ title: `Invite resent to ${a.email}` });
                reload();
              },
              (e: unknown) => setProblem(settingsErrorMessage(e, "Couldn't resend the invite.")),
            )
            .finally(() => setMutating(false));
        },
      });
    }
    items.push({
      id: "remove",
      label: pending ? "Cancel invite" : "Remove admin",
      destructive: true,
      disabled: mutating,
      onSelect: () => setRemoveFor(a),
    });
    return items;
  }

  async function confirmAccess() {
    const a = accessFor;
    if (!a || mutating) return;
    const next: AdminAccess = a.access === "admin" ? "super_admin" : "admin";
    setAccessFor(null);
    setProblem(null);
    setMutating(true);
    try {
      await changeAdminAccess(a.id, next);
      toast.show({ title: `${displayName(a)} is now ${ACCESS_LABEL[next]}` });
      reload();
    } catch (e) {
      setProblem(settingsErrorMessage(e, "Couldn't change access."));
    } finally {
      setMutating(false);
    }
  }

  async function confirmRemove() {
    const a = removeFor;
    if (!a || mutating) return;
    setRemoveFor(null);
    setProblem(null);
    setMutating(true);
    try {
      await removeAdmin(a.id);
      toast.show({ title: a.status === "invite_pending" ? `Cancelled the invite to ${a.email}` : `Removed ${displayName(a)}` });
      reload();
    } catch (e) {
      setProblem(settingsErrorMessage(e, "Couldn't remove this admin."));
    } finally {
      setMutating(false);
    }
  }

  const rows = data ?? [];
  const removingPending = removeFor?.status === "invite_pending";

  return (
    <>
      {(error || problem) && (
        <ErrorBanner message={problem ?? "Couldn't load admins. Try again."} onRetry={problem ? undefined : reload} />
      )}
      <section aria-labelledby="ad-h" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="ad-h" className="m-0 text-[17px] font-semibold leading-6 text-ink">
              Admins
            </h2>
            <p className="m-0 text-[13px] leading-5 text-ink-faint">
              Super admins can also manage admins, AI, data and privacy, and email.
            </p>
          </div>
          <Button
            ref={inviteButton}
            variant="primary"
            iconLeft="plus"
            aria-expanded={inviteOpen}
            aria-controls={inviteOpen ? formId : undefined}
            onClick={() => setInviteOpen(true)}
          >
            Invite admin
          </Button>
        </div>

        {inviteOpen && (
          <InviteAdminForm
            id={formId}
            onCancel={closeInvite}
            onInvited={(a) => {
              closeInvite();
              toast.show({ title: `Invite sent to ${a.email}` });
              reload();
            }}
          />
        )}

        <div role="table" aria-label="Admins" aria-busy={(loading && !data) || undefined}>
          <div role="rowgroup">
            <div
              role="row"
              className={cn(COLS, "h-10 items-center border-t border-line px-[22px] text-xs font-semibold leading-4 text-ink-faint")}
            >
              <span role="columnheader">Name</span>
              <span role="columnheader">Access</span>
              <span role="columnheader" className="hidden text-right min-[720px]:block">
                Last active
              </span>
              <span role="columnheader">
                <span className="sr-only">Actions</span>
              </span>
            </div>
          </div>
          <div role="rowgroup">
            {loading && !data
              ? [0, 1, 2].map((i) => (
                  <div key={i} role="row" className={cn(COLS, "min-h-16 items-center border-t border-line px-[22px]")}>
                    <span role="cell" className="flex items-center gap-3">
                      <span className="size-[34px] flex-none animate-pulse rounded-full bg-neutral-soft" />
                      <span className="h-3.5 w-40 animate-pulse rounded bg-neutral-soft" />
                    </span>
                    <span role="cell" className="h-5 w-16 animate-pulse rounded-full bg-neutral-soft" />
                    <span role="cell" className="hidden min-[720px]:block" />
                    <span role="cell" />
                  </div>
                ))
              : rows.map((a) => (
                  <AdminRow key={a.id} admin={a} self={a.id === currentAdminId} actions={rowActions(a)} />
                ))}
            {!loading && data && rows.length === 0 && (
              <div role="row" className="border-t border-line px-[22px] py-10 text-center">
                <span role="cell" className="text-[13px] text-ink-faint">
                  No admins yet. Invite someone to share the work.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={accessFor !== null}
        title={
          accessFor
            ? accessFor.access === "admin"
              ? `Make ${displayName(accessFor)} a super admin?`
              : `Change ${displayName(accessFor)} to admin?`
            : ""
        }
        body={
          accessFor?.access === "admin"
            ? "They will also be able to manage admins, AI, data and privacy, and email."
            : "They will no longer be able to manage admins, AI, data and privacy, or email."
        }
        confirmLabel={accessFor?.access === "admin" ? "Make super admin" : "Change to admin"}
        onCancel={() => setAccessFor(null)}
        onConfirm={() => void confirmAccess()}
      />
      <ConfirmDialog
        open={removeFor !== null}
        tone="destructive"
        title={removeFor ? (removingPending ? `Cancel the invite to ${removeFor.email}?` : `Remove ${displayName(removeFor)}?`) : ""}
        body={
          removingPending
            ? "The invite stops working. You can invite them again later."
            : "They can no longer log in to this console. Their past changes stay in the audit log. You can invite them again later."
        }
        confirmLabel={removingPending ? "Cancel invite" : "Remove admin"}
        cancelLabel={removingPending ? "Keep invite" : "Cancel"}
        onCancel={() => setRemoveFor(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

function AdminRow({ admin: a, self, actions }: { admin: Admin; self: boolean; actions: MenuItem[] }) {
  const pending = a.status === "invite_pending";
  const name = displayName(a);
  const superAdmin = a.access === "super_admin";
  const last = pending
    ? { text: a.invitedAt ? invitedLabel(a.invitedAt) : "Invite sent", tone: "text-improve-text" }
    : a.lastActiveAt
      ? { text: relativeTime(a.lastActiveAt), tone: "text-ink-soft" }
      : { text: "Not yet", tone: "text-ink-faint" };

  return (
    <div role="row" className={cn(COLS, "min-h-16 items-center border-t border-line px-[22px] py-3")}>
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <Avatar
          name={name}
          size={32}
          tone={self ? "primary" : "neutral"}
          className={cn("!size-[34px] !text-xs", pending && "!bg-transparent border border-dashed border-neutral-line")}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-5 text-ink">
            <span className="truncate">{name}</span>
            {self && (
              <span className="flex-none rounded-[5px] border border-neutral-line px-1.5 py-px text-[11px] font-semibold leading-4 text-ink-muted">
                You
              </span>
            )}
          </span>
          <span className="truncate text-[13px] leading-[18px] text-ink-faint">{a.email}</span>
        </div>
      </div>
      <span role="cell" className="justify-self-start">
        <span
          className={cn(
            "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold leading-4",
            superAdmin ? "bg-primary-tint text-primary-text" : "bg-neutral-soft text-neutral-text",
          )}
        >
          {ACCESS_LABEL[a.access]}
        </span>
      </span>
      <span role="cell" className={cn("hidden text-right text-[13px] leading-5 min-[720px]:block", last.tone)}>
        {last.text}
      </span>
      <span role="cell" className="justify-self-end">
        {self ? (
          <button
            type="button"
            aria-disabled="true"
            aria-label="Admin actions"
            title="You can’t change your own access"
            className="inline-flex size-[30px] cursor-not-allowed items-center justify-center rounded-[7px] text-neutral-line"
          >
            <Icon name="more" size={16} />
          </button>
        ) : (
          <Menu label={`Actions for ${name}`} items={actions} />
        )}
      </span>
    </div>
  );
}

function InviteAdminForm({
  id,
  onCancel,
  onInvited,
}: {
  id: string;
  onCancel: () => void;
  onInvited: (a: Admin) => void;
}) {
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AdminAccess>("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_RE.test(email.trim());

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const a = await inviteAdmin({ email, access });
      onInvited(a);
    } catch (e) {
      setError(settingsErrorMessage(e, "Couldn't send the invite."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id={id}
      aria-label="Invite admin"
      className="mx-[22px] mb-[18px] flex flex-wrap items-end gap-3 rounded-card border border-primary-soft bg-surface-sunken p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <Field label="Email" error={error} className="min-w-0 flex-[1_1_240px]">
        {({ id: inputId, describedBy, invalid }) => (
          <Input
            id={inputId}
            type="email"
            tone="surface"
            autoFocus
            autoComplete="off"
            invalid={invalid}
            aria-describedby={describedBy}
            placeholder="name@company.com"
            className="!h-10"
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
        <SegmentedControl<AdminAccess> label="Access" options={ACCESS_OPTIONS} value={access} onChange={setAccess} />
      </div>
      <div className="flex gap-2">
        <Button className="!border-neutral-line !rounded-[9px] !px-3.5" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="!rounded-[9px]"
          disabled={busy}
          aria-busy={busy || undefined}
          disabledReason={valid ? undefined : "Enter a valid email address"}
        >
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
