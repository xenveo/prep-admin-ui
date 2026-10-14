"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [drafting, setDrafting] = useState(false);
  const [lastDraft, setLastDraft] = useState<string | null>(null);

  const snapshot = JSON.stringify({ title, seniority, description, skills });
  const saved = useRef(snapshot);
  const titleError = title.trim() === "" ? "Enter a role title" : undefined;

  useEffect(() => {
    if (readOnly || snapshot === saved.current || titleError) return;
    const timer = setTimeout(() => {
      setSave("saving");
      updateRole(role.id, { title, seniority, description, keySkills: skills }).then(
        () => {
          saved.current = snapshot;
          setSave("saved");
          emitRoleChanged(role.id);
        },
        () => setSave("error"),
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [snapshot, readOnly, titleError, role.id, title, seniority, description, skills]);

  async function draft() {
    setDrafting(true);
    try {
      const created = await draftFlashCardsWithAI(role.id);
      setLastDraft("just now");
      emitRoleChanged(role.id);
      toast.show({
        title: `AI drafted ${created.length} flash ${pluralize(created.length, "card")}`,
        detail: "They stay hidden from candidates until you approve them.",
        action: { label: "Review cards", href: `/roles/${encodeURIComponent(role.id)}/cards` },
      });
    } catch (e) {
      toast.show({ title: "Couldn't draft with AI", detail: e instanceof Error ? e.message : undefined });
    } finally {
      setDrafting(false);
    }
  }

  const saveText =
    save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Couldn't save changes. Try again." : "";

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
          AI will draft flash cards and questions from this description. Nothing is shown to candidates until you approve it.
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
