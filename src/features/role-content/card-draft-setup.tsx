"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { SENIORITY_LABEL, CARD_CATEGORY_LABEL, type CardCategory, type JobRole } from "@/lib/types";
import type { CardDraftInput } from "@/services/card-draft-batches";
import { CARD_CATEGORIES } from "./card-draft-utils";

const initialMix = (): Record<CardCategory, number> => ({ behavioural: 2, situational: 1, role_knowledge: 1, motivation: 1 });
type Topic = { label: string; selected: boolean; custom: boolean };

export function CardDraftSetup({ role, busy, onGenerate }: { role: JobRole; busy: boolean; onGenerate: (input: CardDraftInput) => void }) {
  const [preset, setPreset] = useState("5");
  const [customCount, setCustomCount] = useState("5");
  const [topics, setTopics] = useState<Topic[]>(() => role.keySkills.map((label) => label.trim()).filter((label, index, all) => label && all.findIndex((item) => item.toLowerCase() === label.toLowerCase()) === index).map((label) => ({ label, selected: true, custom: false })));
  const [newTopic, setNewTopic] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
  const [mixMode, setMixMode] = useState("balanced");
  const [mix, setMix] = useState(initialMix);
  const [guidance, setGuidance] = useState("");
  const count = Number(preset === "custom" ? customCount : preset);
  const countValid = Number.isInteger(count) && count >= 1 && count <= 10;
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0);
  const mixValid = mixMode === "balanced" || (total === count && Object.values(mix).every((value) => Number.isInteger(value) && value >= 0 && value <= 10));
  const selectedTopics = topics.filter((topic) => topic.selected).map((topic) => topic.label);
  const description = role.description.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const archived = role.status === "archived";

  function addTopic() {
    const value = newTopic.trim();
    if (!value) return;
    if (value.length > 60) { setTopicError("Keep each topic to 60 characters or fewer."); return; }
    const existing = topics.find((topic) => topic.label.toLowerCase() === value.toLowerCase());
    if (existing) setTopics((current) => current.map((topic) => topic === existing ? { ...topic, selected: true } : topic));
    else if (topics.length >= 30) { setTopicError("Use up to 30 topics per batch."); return; }
    else setTopics((current) => [...current, { label: value, selected: true, custom: true }]);
    setNewTopic("");
    setTopicError(null);
  }

  return (
    <div className="grid items-start gap-5 min-[1150px]:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!countValid || !mixValid || busy || archived) return;
        onGenerate({ count, topics: selectedTopics, categoryMix: mixMode === "balanced" ? "balanced" : mix, guidance: guidance.trim() });
      }} className="min-w-0 overflow-hidden rounded-panel border border-line bg-surface">
        <fieldset disabled={busy || archived} className="m-0 flex min-w-0 flex-col gap-7 border-0 p-5 sm:p-6">
          <div className="flex flex-col items-start gap-2.5">
            <label className="text-sm font-semibold text-ink" htmlFor="draft-custom-count">Number of cards</label>
            <SegmentedControl value={preset} onChange={setPreset} label="Number of cards" options={[{ value: "3", label: "3" }, { value: "5", label: "5" }, { value: "10", label: "10" }, { value: "custom", label: "Custom" }]} />
            {preset === "custom" && <div className="flex items-center gap-2">
              <Input id="draft-custom-count" type="number" min={1} max={10} step={1} value={customCount} onChange={(event) => setCustomCount(event.target.value)} invalid={!countValid} aria-label="Custom number of cards" aria-describedby="draft-count-help" className="w-24 text-right" />
              <span className="text-sm text-ink-muted">cards</span>
            </div>}
            <p id="draft-count-help" className={cn("m-0 text-xs", countValid ? "text-ink-faint" : "text-improve-text")}>{countValid ? "Between 1 and 10 per batch." : "Choose a whole number from 1 to 10."}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <div><h2 className="m-0 text-sm font-semibold text-ink">Topics</h2><p className="m-0 mt-1 text-[13px] text-ink-muted">From the role’s key skills. Select the ones to cover, or add your own.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {topics.map((topic) => <span key={topic.label} className={cn("inline-flex max-w-full items-center rounded-full border text-[13px]", topic.selected ? "border-primary-line bg-primary-tint text-primary-text" : "border-line text-ink-muted")}>
                <button type="button" aria-pressed={topic.selected} onClick={() => setTopics((current) => current.map((item) => item === topic ? { ...item, selected: !item.selected } : item))} className={cn("focus-inset cursor-pointer rounded-full px-3 py-1.5 text-left wrap-anywhere", topic.custom && "pr-1.5")}>
                  {topic.selected && <span aria-hidden="true" className="mr-1.5">✓</span>}{topic.label}
                </button>
                {topic.custom && <button type="button" aria-label={`Remove ${topic.label}`} onClick={() => setTopics((current) => current.filter((item) => item !== topic))} className="focus-inset mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-row-hover">×</button>}
              </span>)}
              <Input value={newTopic} onChange={(event) => { setNewTopic(event.target.value); setTopicError(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTopic(); } }} onBlur={addTopic} aria-label="Add a topic" placeholder="Add a topic and press Enter" maxLength={60} className="h-9! w-[240px] max-w-full rounded-full! border-dashed! text-[13px]!" />
            </div>
            <p role={topicError ? "alert" : undefined} className={cn("m-0 text-xs leading-5", topicError ? "text-improve-text" : "text-ink-faint")}>{topicError ?? (selectedTopics.length ? `Covering: ${selectedTopics.join(", ")}.` : "No topics selected. AI will draw on the whole role description.")}</p>
          </div>

          <div className="flex flex-col items-start gap-2.5">
            <h2 className="m-0 text-sm font-semibold text-ink">Category mix</h2>
            <SegmentedControl value={mixMode} onChange={setMixMode} label="Category mix" options={[{ value: "balanced", label: "Balanced" }, { value: "custom", label: "Choose the mix" }]} />
            {mixMode === "balanced" ? <p className="m-0 text-[13px] leading-5 text-ink-muted">Spreads {countValid ? count : "your"} cards across behavioural, situational, role knowledge and motivation.</p> : <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {CARD_CATEGORIES.map((category) => <label key={category} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[13px] text-ink">
                {CARD_CATEGORY_LABEL[category]}<Input type="number" min={0} max={10} step={1} value={Number.isNaN(mix[category]) ? "" : mix[category]} onChange={(event) => setMix((current) => ({ ...current, [category]: event.target.value === "" ? Number.NaN : Number(event.target.value) }))} className="h-9! w-20 text-right" />
              </label>)}
              <p role={!mixValid ? "status" : undefined} className={cn("m-0 text-xs sm:col-span-2", mixValid ? "text-primary-text" : "text-improve-text")}>Total {Number.isFinite(total) ? total : "—"} of {countValid ? count : "—"}{mixValid ? "." : ". Match the number of cards."}</p>
            </div>}
          </div>

          <label className="flex flex-col gap-2 text-sm font-semibold text-ink" htmlFor="draft-guidance">
            <span>Additional guidance <span className="font-normal text-ink-faint">(optional)</span></span>
            <Textarea id="draft-guidance" rows={3} value={guidance} onChange={(event) => setGuidance(event.target.value)} maxLength={2000} placeholder="For example: Focus on handling difficult customers." className="min-h-24! font-normal" aria-describedby="draft-guidance-count" />
            <span id="draft-guidance-count" className="self-end text-xs font-normal text-ink-faint">{guidance.length} / 2,000</span>
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
          <p className="m-0 mr-auto max-w-[280px] text-xs leading-5 text-ink-faint">You can leave this page while it runs. Your batch is saved automatically.</p>
          <ButtonLink href={`/roles/${encodeURIComponent(role.id)}/cards`}>Cancel</ButtonLink>
          <Button type="submit" variant="primary" disabled={busy || !countValid || !mixValid || archived} aria-busy={busy}>{busy ? "Starting…" : countValid ? `Generate ${count} ${count === 1 ? "card" : "cards"}` : "Generate cards"}</Button>
        </div>
      </form>

      <aside aria-labelledby="draft-uses-heading" className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-5 text-[13px] leading-5">
        <h2 id="draft-uses-heading" className="m-0 text-base font-semibold text-ink">What AI uses</h2>
        <div><h3 className="m-0 text-xs font-semibold text-ink-faint">Role</h3><p className="m-0 mt-1 text-ink">{role.title} · {SENIORITY_LABEL[role.seniority]}</p></div>
        <div><h3 className="m-0 text-xs font-semibold text-ink-faint">Description</h3><p className="m-0 mt-1 line-clamp-4 text-ink-muted">{description || "No role description yet. Add one to give AI more context."}</p><Link href={`/roles/${encodeURIComponent(role.id)}/details`} className="mt-1 inline-block font-semibold text-primary-text hover:underline">Edit in Details</Link></div>
        <div><h3 className="m-0 text-xs font-semibold text-ink-faint">Avoids repeating</h3><p className="m-0 mt-1 text-ink-muted">The {role.flashCardCount} {role.flashCardCount === 1 ? "card" : "cards"} already in this role</p></div>
        <div className="border-t border-line pt-4"><h3 className="m-0 font-semibold text-ink">Every card includes</h3><ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-ink-muted">{["Category and question", "3 strong-answer points", "2 common mistakes", "1 practical tip", "A sample answer outline"].map((text) => <li key={text} className="flex gap-2"><span aria-hidden="true" className="text-primary-text">✓</span>{text}</li>)}</ul><p className="m-0 mt-3 text-xs leading-5 text-ink-faint">Incomplete responses are retried before any cards are saved.</p></div>
        {archived && <p role="status" className="m-0 text-improve-text">This role is archived. Its content is read-only.</p>}
      </aside>
    </div>
  );
}
