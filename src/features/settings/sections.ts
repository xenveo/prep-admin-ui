export type SectionKey = "admins" | "ai" | "usage" | "privacy" | "email" | "audit";

export type SectionGroup = "Team" | "AI" | "Candidates";

export type SectionDef = { key: SectionKey; label: string; description: string; superOnly: boolean; group: SectionGroup };

/** Nav order: grouped as Team / AI / Candidates. */
export const SECTIONS: SectionDef[] = [
  { key: "admins", label: "Admins", description: "People who can use this console.", superOnly: true, group: "Team" },
  { key: "ai", label: "Voice and prompts", description: "How the AI interviewer sounds and gives feedback.", superOnly: false, group: "AI" },
  { key: "usage", label: "Usage and cost", description: "What AI calls cost, and how sessions compare with the per-session target.", superOnly: true, group: "AI" },
  { key: "privacy", label: "Data and privacy", description: "How long candidate data is kept and who can delete it.", superOnly: true, group: "Candidates" },
  { key: "email", label: "Invite email", description: "What invite emails look like.", superOnly: true, group: "Candidates" },
  { key: "audit", label: "Audit log", description: "Who changed what, and when.", superOnly: false, group: "Candidates" },
];

export const SECTION_GROUPS: { label: SectionGroup; sections: SectionDef[] }[] = (["Team", "AI", "Candidates"] as const).map(
  (label) => ({ label, sections: SECTIONS.filter((s) => s.group === label) }),
);
