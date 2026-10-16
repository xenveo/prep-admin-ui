"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, LoadingCard } from "./load-state";
import { useSaveHeader } from "./save-header";
import { useSettingsDraft } from "./use-settings-draft";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/*
 * The preview is a light "paper" email in both themes: light mode uses the page tokens, dark mode
 * borrows the toast pair (light fill, dark ink), which is the theme's inverted surface.
 */
const PAPER = "bg-[light-dark(var(--surface),var(--toast-bg))] text-[color:light-dark(var(--ink),var(--toast-text))]";
const PAPER_MUTED = "text-[color:light-dark(var(--ink-muted),color-mix(in_srgb,var(--toast-text)_62%,transparent))]";
const PAPER_LINE = "border-[color:light-dark(var(--line),color-mix(in_srgb,var(--toast-text)_10%,transparent))]";

export function EmailSection() {
  const draft = useSettingsDraft();
  const [touchedReply, setTouchedReply] = useState(false);
  const replyTo = draft.values?.replyTo.trim() ?? "";
  const replyValid = !replyTo || EMAIL_RE.test(replyTo);

  useSaveHeader(draft, () => {
    if (!replyValid) {
      setTouchedReply(true);
      return;
    }
    void draft.save();
  });

  if (draft.loadError && !draft.values) return <ErrorBanner message="Couldn't load settings. Try again." onRetry={draft.reload} />;
  if (!draft.values) return <LoadingCard />;
  const v = draft.values;
  const serverReplyError = draft.saveError && /reply-to/i.test(draft.saveError) ? draft.saveError : null;
  const otherError = draft.saveError && !serverReplyError ? draft.saveError : null;
  const replyError = !replyValid && touchedReply ? "Enter a valid email address." : serverReplyError;

  return (
    <>
      {otherError && <ErrorBanner message={otherError} />}
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="invite-email-h"
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-5 rounded-panel border border-line bg-surface p-[22px]"
        >
          <div className="flex flex-col gap-1">
            <h2 id="invite-email-h" className="m-0 text-[17px] leading-[23px] font-semibold text-ink">
              Invite email
            </h2>
            <p className="m-0 text-[13px] leading-5 text-ink-faint">Sent when you invite a candidate.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sender-name" className="text-sm leading-5 font-semibold text-ink">
              Sender name
            </label>
            <Input
              id="sender-name"
              className="!h-10 !text-sm"
              value={v.senderName}
              onChange={(e) => draft.set("senderName", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="reply-to" className="text-sm leading-5 font-semibold text-ink">
              Reply-to address
            </label>
            <Input
              id="reply-to"
              type="email"
              className="!h-10 !text-sm"
              invalid={Boolean(replyError)}
              aria-describedby="reply-to-note"
              placeholder="recruiting@company.com"
              value={v.replyTo}
              onChange={(e) => draft.set("replyTo", e.target.value)}
              onBlur={() => setTouchedReply(true)}
            />
            <span
              id="reply-to-note"
              role={replyError ? "alert" : undefined}
              className={replyError ? "text-xs leading-4 text-error" : "text-xs leading-4 text-ink-faint"}
            >
              {replyError ?? "Candidate replies go here."}
            </span>
          </div>
          <div className="flex items-center gap-4 border-t border-line pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-sm leading-5 font-semibold text-ink">Email candidates when they complete a session</span>
              <span className="text-[13px] leading-5 text-ink-faint">Sends a short note with their score and a link to the report.</span>
            </div>
            <Switch
              label="Email candidates when they complete a session"
              checked={v.sessionCompleteEmail}
              onChange={(c) => draft.set("sessionCompleteEmail", c)}
            />
          </div>
        </section>
        <section aria-labelledby="invite-preview-h" className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <h2
            id="invite-preview-h"
            className="m-0 font-mono text-xs leading-4 font-normal tracking-[0.08em] text-ink-faint uppercase"
          >
            Preview
          </h2>
          <div className={`overflow-hidden rounded-panel border border-[color:light-dark(var(--line),transparent)] ${PAPER}`}>
            <div className={`flex flex-col gap-1 border-b px-5 py-3.5 text-[13px] leading-5 ${PAPER_LINE}`}>
              <span>
                <span className={PAPER_MUTED}>From</span> <strong>{v.senderName || "–"}</strong>
              </span>
              {replyTo && (
                <span>
                  <span className={PAPER_MUTED}>Reply-to</span> {replyTo}
                </span>
              )}
              <span>
                <span className={PAPER_MUTED}>Subject</span> <strong>You’re invited to practise for your interview</strong>
              </span>
            </div>
            <div className="flex flex-col gap-3.5 px-5 py-6 text-[15px] leading-[1.55]">
              <p className="m-0">Hi Priya,</p>
              <p className="m-0">
                You’ve been invited to prepare for the <strong>Customer Support Associate</strong> interview with short flash
                cards and a voice mock interview. You’ll get feedback after every answer.
              </p>
              <span className="self-start rounded-lg bg-[light-dark(var(--primary),var(--bg))] px-[18px] py-[11px] text-sm leading-5 font-bold text-[color:light-dark(var(--on-primary),var(--primary))]">
                Log in to start
              </span>
              <p className={`m-0 text-[13px] leading-5 ${PAPER_MUTED}`}>
                This link is just for you. It expires in {v.inviteLinkExpiryDays} days.
              </p>
            </div>
          </div>
          <p className="m-0 text-xs leading-4 text-ink-faint">Sample name and role. Real invites use the candidate’s details.</p>
        </section>
      </div>
    </>
  );
}
