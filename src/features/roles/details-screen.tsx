"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { emitRoleChanged } from "@/lib/role-events";
import { SENIORITY_LABEL, type Seniority } from "@/lib/types";
import { draftFlashCardsWithAI, updateRole } from "@/services/roles";
import { useRole } from "./role-context";

type RoleDraft = { title: string; seniority: Seniority; description: string; skills: string[] };
type SaveState = "idle" | "saving" | "saved" | "error";

const SENIORITIES = Object.keys(SENIORITY_LABEL) as Seniority[];
/** Role editor fields use 14px labels with an 8px gap (the shared Field defaults to 13px / 6px). */
const FIELD = "gap-2! [&>label]:text-sm";

export function DetailsScreen() {
  const role = useRole();
  const toast = useToast();
  const readOnly = role.status === "archived";
  const skillsId = useId();
  const [title, setTitle] = useState(role.title);
  const [seniority, setSeniority] = useState<Seniority>(role.seniority);
  const [description, setDescription] = useState(role.description);
  const [skills, setSkills] = useState(role.keySkills);
  const [save, setSave] = useState<SaveState>("idle");
  const draftAbort = useRef<AbortController | null>(null);
  useEffect(() => () => draftAbort.current?.abort(), []);
  const [drafting, setDrafting] = useState(false);
  const [lastDraft, setLastDraft] = useState<string | null>(null);

  const snapshot = JSON.stringify({ title, seniority, description, skills });
  const saved = useRef(snapshot);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const [failedSnapshot, setFailedSnapshot] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const lastQueued = useRef<{snapshot: string; operation: Promise<void>} | null>(null);
  const latest = useRef({ fields: {title, seniority, description, skills}, readOnly, failedSnapshot });
  const titleError = title.trim() === "" ? "Enter a role title" : undefined;

  const persist = useCallback(async function persistDraft(fields: RoleDraft): Promise<void> {
    if (!fields.title.trim()) return;
    const version = JSON.stringify(fields);
    if (lastQueued.current?.snapshot === version) return lastQueued.current.operation;
    setSave("saving");
    setSaveError(null);
    setFailedSnapshot(null);
    // Every write waits for the previous request, including the last edit on navigation.
    const operation = queue.current.catch(() => {}).then(async () => {
      await updateRole(role.id, {title: fields.title, seniority: fields.seniority, description: fields.description, keySkills: fields.skills});
      saved.current = version;
      setSavedSnapshot(version);
      setSave("saved");
      emitRoleChanged(role.id);
    });
    queue.current = operation;
    lastQueued.current = {snapshot: version, operation};
    try { await operation; }
    catch (failure) {
      if (lastQueued.current?.operation === operation) {
        lastQueued.current = null;
        setSave("error");
        setFailedSnapshot(version);
        setSaveError(failure instanceof Error ? failure.message : "Couldn't save these changes.");
      }
      toast.show({title: "Role changes weren't saved", detail: failure instanceof Error ? failure.message : "Try again.", action: {label: "Retry save", onClick: () => { void persistDraft(latest.current.fields).catch(() => {}); }}});
      throw failure;
    }
  }, [role.id, toast]);

  useEffect(() => {
    latest.current = {fields: {title, seniority, description, skills}, readOnly, failedSnapshot};
  }, [title, seniority, description, skills, readOnly, failedSnapshot]);

  useEffect(() => {
    if (readOnly || titleError || snapshot === savedSnapshot || snapshot === failedSnapshot) return;
    const timer = setTimeout(() => {
      void persist({title, seniority, description, skills}).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshot, savedSnapshot, failedSnapshot, readOnly, titleError, persist, title, seniority, description, skills]);

  useEffect(() => () => {
    const current = latest.current;
    const version = JSON.stringify(current.fields);
    if (!current.readOnly && version !== current.failedSnapshot && (version !== saved.current || lastQueued.current)) {
      // persist deduplicates an already queued identical snapshot and shows a
      // shared retry toast if the final request fails after this screen closes.
      void persist(current.fields).catch(() => {});
    }
  }, [persist]);

  async function draft() {
    setDrafting(true);
    draftAbort.current?.abort();
    const controller = new AbortController();
    draftAbort.current = controller;
    try {
      const created = await draftFlashCardsWithAI(role.id, controller.signal);
      setLastDraft("just now");
      emitRoleChanged(role.id);
      toast.show({
        title: `AI drafted ${created.length} flash ${pluralize(created.length, "card")}`,
        detail: "They stay hidden from candidates until you approve them.",
        action: { label: "Review cards", href: `/roles/${encodeURIComponent(role.id)}/cards` },
      });
    } catch (e) {
      if (!controller.signal.aborted) toast.show({ title: "Couldn't draft with AI", detail: e instanceof Error ? e.message : undefined });
    } finally {
      if (!controller.signal.aborted) setDrafting(false);
    }
  }

  const dirty = snapshot !== savedSnapshot;
  const saveText =
    save === "error"
      ? saveError ?? "Couldn't save changes."
      : dirty
        ? "Unsaved changes"
        : save === "saving"
          ? "Saving…"
          : "All changes saved";
  const saveNow = () => {
    void persist({ title, seniority, description, skills }).catch(() => {});
  };
  const approvedCards = Math.max(0, role.flashCardCount - role.aiDraftCardCount);
  const approvedQuestions = Math.max(0, role.questionCount - role.aiDraftQuestionCount);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <fieldset
        disabled={readOnly}
        className="m-0 flex min-w-0 max-w-[880px] flex-[999_1_560px] flex-col gap-[22px] rounded-panel border border-line bg-surface p-6"
      >
        <legend className="sr-only">Role details</legend>
        {readOnly && <p className="m-0 text-sm leading-5 text-ink-muted">This role is archived, so it can’t be edited.</p>}
        <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Role title" error={titleError} className={FIELD}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-[42px]! rounded-[9px]! text-[15px]!"
              />
            )}
          </Field>
          <Field label="Seniority" className={FIELD}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={seniority}
                onChange={(e) => setSeniority(e.target.value as Seniority)}
                className="[&>select]:h-[42px] [&>select]:rounded-[9px] [&>select]:pl-2.5 [&>select]:text-[15px]"
              >
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {SENIORITY_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <RichTextEditor
          label="Description"
          helper="What the job involves. AI uses this to draft flash cards and questions."
          value={description}
          onChange={setDescription}
          minHeight={144}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={skillsId} className="text-sm leading-5 font-semibold text-ink">
            Key skills
          </label>
          <TagInput inputId={skillsId} label="Key skills" tags={skills} onChange={setSkills} placeholder="Add a skill and press Enter" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-[18px]">
          <p
            aria-live="polite"
            className={cn("m-0 text-[13px] leading-[18px]", save === "error" ? "text-improve-text" : "text-ink-faint")}
          >
            {saveText}
          </p>
          <Button
            variant="primary"
            disabled={save === "saving" || (!dirty && save !== "error")}
            disabledReason={titleError}
            onClick={saveNow}
            className="px-[18px]!"
          >
            {save === "error" ? "Retry save" : "Save changes"}
          </Button>
        </div>
      </fieldset>

      <aside
        aria-labelledby="ai-draft-title"
        className="flex min-w-0 max-w-[420px] flex-[1_1_280px] flex-col gap-3 rounded-panel border border-line bg-surface p-5"
      >
        <h2 id="ai-draft-title" className="m-0 text-base leading-[22px] font-semibold text-ink">
          Draft content with AI
        </h2>
        <p className="m-0 text-sm leading-[1.55] text-ink-muted">
          AI drafts flash cards from the description and skills. Nothing is shown to candidates until you approve it.
        </p>
        <dl className="m-0 mt-1 flex flex-col border-t border-line text-[13px] leading-[18px]">
          <div className="flex justify-between gap-3 border-b border-line py-2.5">
            <dt className="text-ink-faint">Flash cards</dt>
            <dd className="m-0 text-ink">{approvedCards} approved</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-line py-2.5">
            <dt className="text-ink-faint">Questions</dt>
            <dd className="m-0 text-ink">{approvedQuestions} approved</dd>
          </div>
        </dl>
        {role.aiDraftCardCount > 0 && (
          <Link
            href={`/roles/${encodeURIComponent(role.id)}/cards`}
            className="w-fit rounded-sm text-[13px] leading-[18px] font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            {role.aiDraftCardCount} flash {pluralize(role.aiDraftCardCount, "card")} waiting for review
          </Link>
        )}
        <Button
          variant="secondary-teal"
          iconLeft="sparkle"
          disabled={drafting || readOnly}
          onClick={draft}
          className="self-start"
        >
          {drafting ? "Drafting…" : "Draft with AI"}
        </Button>
        {lastDraft && <p className="m-0 text-xs leading-4 text-ink-faint">Last draft, {lastDraft}</p>}
      </aside>
    </div>
  );
}
