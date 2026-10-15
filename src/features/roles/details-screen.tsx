"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import { emitRoleChanged } from "@/lib/role-events";
import { SENIORITY_LABEL, type Seniority } from "@/lib/types";
import { draftFlashCardsWithAI, updateRole } from "@/services/roles";
import { useRole } from "./role-context";

type RoleDraft = { title: string; seniority: Seniority; description: string; skills: string[] };
type SaveState = "idle" | "saving" | "saved" | "error";

const SENIORITIES = Object.keys(SENIORITY_LABEL) as Seniority[];

export function DetailsScreen() {
  const role = useRole();
  const toast = useToast();
  const readOnly = role.status === "archived";
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

  const saveText =
    save === "error" ? saveError ?? "Couldn't save changes." : snapshot !== savedSnapshot ? "Unsaved changes…" : save === "saving" ? "Saving…" : save === "saved" ? "Saved" : "";

  return (
    <div className="grid grid-cols-1 items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
      <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-5 rounded-lg border border-line bg-surface p-6">
        <legend className="sr-only">Role details</legend>
        {readOnly && <p className="m-0 text-sm text-ink-muted">This role is archived, so it can’t be edited.</p>}
        <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Role title" error={titleError}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>
          <Field label="Seniority">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority)}>
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
          minHeight={160}
        />
        <TagInput label="Key skills" tags={skills} onChange={setSkills} placeholder="Add a skill and press Enter" />
        <p aria-live="polite" className="m-0 min-h-4 text-xs leading-4 text-ink-muted">
          {saveText}
        </p>
        {save === "error" && <Button className="self-start" disabled={Boolean(titleError)} onClick={() => { void persist({title, seniority, description, skills}).catch(() => {}); }}>Retry save</Button>}
      </fieldset>

      <aside aria-labelledby="ai-draft-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-dashed border-improve bg-improve-soft px-2 text-xs font-semibold text-ai-text">
            <Icon name="sparkle" size={14} />
            AI
          </span>
          <h2 id="ai-draft-title" className="m-0 text-base font-semibold leading-6 text-ink">
            Draft content with AI
          </h2>
        </div>
        <p className="m-0 text-sm text-ink-muted">
          AI will draft flash cards from this description. Nothing is shown to candidates until you approve it.
        </p>
        <div>
          <Button
            variant="secondary-teal"
            iconLeft="sparkle"
            disabled={drafting || readOnly}
            onClick={draft}
          >
            {drafting ? "Drafting…" : "Draft with AI"}
          </Button>
        </div>
        {lastDraft && <p className="m-0 text-xs leading-4 text-ink-muted">Last draft, {lastDraft}</p>}
        {role.aiDraftCardCount > 0 && (
          <Link
            href={`/roles/${encodeURIComponent(role.id)}/cards`}
            className="w-fit rounded-sm text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            {role.aiDraftCardCount} flash {pluralize(role.aiDraftCardCount, "card")} waiting for review
          </Link>
        )}
      </aside>
    </div>
  );
}
