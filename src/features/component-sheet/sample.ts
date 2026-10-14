import type { Band } from "@/lib/bands";
import type { Highlight } from "@/components/media/transcript-highlights";

export type SampleCandidate = {
  id: string;
  name: string;
  email: string;
  status: "active" | "invite-pending" | "deactivated";
  sessions: number;
  score: number | null;
  band?: Band;
  change: number | null;
  last: string;
};

export const SAMPLE_CANDIDATES: SampleCandidate[] = [
  { id: "c1", name: "Priya Sharma", email: "priya@example.com", status: "active", sessions: 3, score: 78, band: "nearly", change: 24, last: "Today" },
  { id: "c2", name: "Ananya Iyer", email: "ananya@example.com", status: "active", sessions: 2, score: 64, band: "developing", change: -5, last: "Yesterday" },
  { id: "c3", name: "Rahul Verma", email: "rahul@example.com", status: "invite-pending", sessions: 0, score: null, change: null, last: "Not yet" },
  { id: "c4", name: "Karan Malhotra", email: "karan@example.com", status: "deactivated", sessions: 1, score: 42, band: "not_ready", change: null, last: "29 Sep" },
];

export const SAMPLE_TRANSCRIPT =
  "I led the migration of our reporting tool. We moved fifteen dashboards in six weeks, and I think it went okay, um, mostly because the team was good.";

export const SAMPLE_HIGHLIGHTS: Highlight[] = [
  { text: "We moved fifteen dashboards in six weeks", kind: "match", note: "gives a concrete result" },
  { text: "I think it went okay, um, mostly", kind: "issue", note: "hedging weakens the outcome" },
];
