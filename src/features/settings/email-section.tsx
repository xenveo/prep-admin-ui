"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, LoadingCard } from "./load-state";
import { SettingRow, SettingsCard } from "./setting-row";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

export function EmailSection() {
  const draft = useSettingsDraft();
  useSaveHeader(draft, () => void draft.save());

  if (draft.loadError && !draft.values) return <ErrorBanner message="Couldn't load settings. Try again." onRetry={draft.reload} />;
  if (!draft.values) return <LoadingCard />;
  const v = draft.values;
  const replyError = draft.saveError && /reply-to/i.test(draft.saveError) ? draft.saveError : undefined;
  const otherError = draft.saveError && !replyError ? draft.saveError : null;

  return (
    <>
      {otherError && <ErrorBanner message={otherError} />}
      <div className="flex flex-wrap items-start gap-4">
        <SettingsCard title="Email" className="min-w-[280px] flex-1 basis-[320px] gap-3">
          <Field label="Sender name" helper="Shown as the sender of invite emails.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} value={v.senderName} onChange={(e) => draft.set("senderName", e.target.value)} />
            )}
          </Field>
          <Field label="Reply-to address" error={replyError}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="email"
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="[reply-to@company.com]"
                value={v.replyTo}
                onChange={(e) => draft.set("replyTo", e.target.value)}
              />
            )}
          </Field>
          <SettingRow label="Email candidates when they complete a session" labelId="session-email-l" hint="Sends a short note with their score and a link to the report.">
            <div className="justify-self-start">
              <Switch
                label="Email candidates when they complete a session"
                checked={v.sessionCompleteEmail}
                onChange={(c) => draft.set("sessionCompleteEmail", c)}
              />
            </div>
          </SettingRow>
        </SettingsCard>
        <section
          aria-label="Invite email preview"
          className="flex min-w-[280px] flex-1 basis-[360px] flex-col gap-2 rounded-md border border-line bg-surface p-5 text-[13px] leading-5"
        >
          <span className="text-xs leading-4 font-semibold text-ink-muted">Invite preview</span>
          <span>
            <span className="text-ink-muted">From:</span> {v.senderName || "–"}
          </span>
          <span>
            <span className="text-ink-muted">Subject:</span> You’re invited to practise for your interview
          </span>
          <div className="flex flex-col gap-2 border-t border-line pt-2">
            <p className="m-0">Hi [Name],</p>
            <p className="m-0">
              You’ve been invited to prepare for the [Role] interview with short flash cards and a voice mock interview. You’ll get
              feedback after every answer.
            </p>
            <span className="self-start rounded-md bg-primary px-3.5 py-2 font-semibold text-on-primary">Log in to start</span>
            <p className="m-0 text-ink-muted">This link is just for you. It expires in {v.inviteLinkExpiryDays} days.</p>
          </div>
        </section>
      </div>
    </>
  );
}
