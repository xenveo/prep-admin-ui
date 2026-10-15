"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu } from "@/components/ui/menu";
import { ReviewBadge } from "@/components/ui/review-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { relativeTime, pluralize } from "@/lib/format";
import { emitRoleChanged, useRoleChanged } from "@/lib/role-events";
import { SENIORITY_LABEL, type JobRole } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { approveRole, archiveRole, getApproveRequirements, getRole } from "@/services/roles";
import { RoleProvider } from "./role-context";

function editedLabel(iso: string): string {
  const rt = relativeTime(iso);
  if (rt.startsWith("Today ")) return `today, ${rt.slice(6)}`;
  if (rt === "Today" || rt === "Yesterday") return rt.toLowerCase();
  return rt;
}

function metaLine(role: JobRole): string {
  const parts = [
    SENIORITY_LABEL[role.seniority],
    `${role.candidatesAssigned} ${pluralize(role.candidatesAssigned, "candidate")} assigned`,
    `edited ${editedLabel(role.updatedAt)}${role.updatedByName ? ` by ${role.updatedByName}` : ""}`,
  ];
  return parts.join(" · ");
}

export function RoleEditorShell({ roleId, children }: { roleId: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const role = useAsync(() => getRole(roleId), [roleId]);
  const req = useAsync(() => getApproveRequirements(roleId), [roleId]);
  const [approveOpen, setApproveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);

  useRoleChanged(roleId, () => {
    role.reload();
    req.reload();
  });

  if (!role.data) {
    return (
      <PageContainer>
        {role.error ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <PageHeader title="Couldn't load this role" breadcrumb={[{ label: "Job roles", href: "/roles" }]} />
            <p className="m-0 text-sm text-ink-muted">{role.error.message}</p>
            <Button onClick={role.reload}>Try again</Button>
          </div>
        ) : (
          <div aria-busy="true" aria-label="Loading role" className="flex flex-col gap-3">
            <div className="h-4 w-40 rounded-sm bg-neutral-soft" />
            <div className="h-7 w-72 rounded-sm bg-neutral-soft" />
            <div className="h-4 w-96 max-w-full rounded-sm bg-neutral-soft" />
          </div>
        )}
      </PageContainer>
    );
  }

  const r = role.data;
  const base = `/roles/${encodeURIComponent(roleId)}`;
  const segment = pathname.split("/").filter(Boolean)[2] ?? "details";
  const activeId = segment === "test" ? "preview" : ["details", "cards", "questions", "settings", "preview"].includes(segment) ? segment : "details";
  const tabs: TabItem[] = [
    { id: "details", label: "Details", href: `${base}/details` },
    {
      id: "cards",
      label: "Flash cards",
      count: r.flashCardCount,
      badge: r.aiDraftCardCount > 0 ? <ReviewBadge count={r.aiDraftCardCount} /> : undefined,
      href: `${base}/cards`,
    },
    { id: "questions", label: "Questions", count: r.questionCount, href: `${base}/questions` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
    { id: "preview", label: "Preview", href: `${base}/preview` },
  ];

  const unmet = req.data?.firstUnmet ?? undefined;
  const toNotify = req.data?.candidatesToNotify ?? r.candidatesAssigned;

  async function confirmApprove() {
    if (busy) return;
    setBusy(true);
    try {
      const approved = await approveRole(roleId);
      setApproveOpen(false);
      emitRoleChanged(roleId);
      toast.show({
        title: `${r.title} is approved`,
        detail: approved.notified > 0 ? `${approved.notified} ${pluralize(approved.notified, "candidate")} notified by email.` : undefined,
      });
    } catch (e) {
      setApproveOpen(false);
      toast.show({ title: "Couldn't approve this role", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    if (busy) return;
    setBusy(true);
    try {
      await archiveRole(roleId);
      setArchiveOpen(false);
      emitRoleChanged(roleId);
      toast.show({ title: `${r.title} is archived`, detail: "Scores are kept." });
      router.push("/roles?tab=archived");
    } catch (e) {
      setArchiveOpen(false);
      toast.show({ title: "Couldn't archive this role", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const cards = req.data?.approvedFlashCards ?? r.flashCardCount - r.aiDraftCardCount;
  const questions = req.data?.approvedQuestions ?? r.questionCount - r.aiDraftQuestionCount;

  return (
    <PageContainer>
      <PageHeader
        breadcrumb={[{ label: "Job roles", href: "/roles" }, { label: r.title }]}
        title={r.title}
        statusChip={<StatusChip status={r.status} />}
        meta={metaLine(r)}
        secondaryActions={
          <>
            <ButtonLink href={`${base}/preview`}>Preview as candidate</ButtonLink>
            {r.status !== "archived" && (
              <Menu
                label="More actions"
                align="end"
                items={[{ id: "archive", label: "Archive role", destructive: true, onSelect: () => setArchiveOpen(true) }]}
              />
            )}
          </>
        }
        primaryAction={
          r.status === "draft" ? (
            <Button
              ref={approveRef}
              variant="primary"
              disabled={busy}
              disabledReason={req.loading ? "Checking approval requirements…" : req.error ? "Approval requirements could not be loaded." : unmet}
              onClick={() => setApproveOpen(true)}
            >
              Approve role
            </Button>
          ) : undefined
        }
      />
      <Tabs items={tabs} activeId={activeId} label="Role sections" className="mb-6" panelId="role-tab-panel" />
      <div id="role-tab-panel" role="tabpanel" aria-labelledby={`tab-${activeId}`}>
        <RoleProvider value={r}>{children}</RoleProvider>
      </div>

      <ConfirmDialog
        open={approveOpen}
        title={`Approve ${r.title}?`}
        body={
          toNotify > 0
            ? `${toNotify} assigned ${pluralize(toNotify, "candidate")} will see it on their dashboard and get an email.`
            : "Candidates you assign to this role will see it on their dashboard."
        }
        bullets={[
          `${cards} approved flash ${pluralize(cards, "card")} and ${questions} ${pluralize(questions, "question")} go live.`,
          "Content still marked AI draft stays hidden until you approve it.",
          "You can archive the role later; scores are kept.",
        ]}
        confirmLabel={busy ? "Approving…" : "Approve and notify"}
        onConfirm={confirmApprove}
        onCancel={() => setApproveOpen(false)}
        returnFocusRef={approveRef}
      />
      <ConfirmDialog
        open={archiveOpen}
        tone="destructive"
        title={`Archive ${r.title}?`}
        body="Candidates will no longer see this role and it won't appear when you assign roles. Scores are kept."
        confirmLabel={busy ? "Archiving…" : "Archive role"}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveOpen(false)}
      />
    </PageContainer>
  );
}
