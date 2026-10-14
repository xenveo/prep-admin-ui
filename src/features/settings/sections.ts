export type SectionKey = "admins" | "ai" | "privacy" | "email" | "audit";

export const SECTIONS: { key: SectionKey; label: string; description: string; superOnly: boolean }[] = [
  { key: "admins", label: "Admins", description: "People who can use this console.", superOnly: true },
  { key: "ai", label: "AI and voice", description: "How the AI interviewer sounds and gives feedback.", superOnly: false },
  { key: "privacy", label: "Data and privacy", description: "How long candidate data is kept and who can delete it.", superOnly: true },
  { key: "email", label: "Email", description: "What invite emails look like.", superOnly: true },
  { key: "audit", label: "Audit log", description: "Who changed what, and when.", superOnly: false },
];

