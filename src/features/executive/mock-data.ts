/**
 * Mock executive-report data. Layout preview only: every value is generated, not read from the API.
 *
 * Counts are stored at their smallest grain (recruiter × role × month cohorts, role × month
 * snapshots) and every total on screen is summed from them, so figures stay consistent when the
 * period or role filter changes. Months differ in volume *and* in rates, so month-over-month
 * comparisons move the way real data would.
 */
import type { Band } from "@/lib/bands";
import type { DimensionId } from "@/lib/types";

export type RoleId = "engineering" | "sales" | "product" | "design";
export type FlagType = "too_high" | "too_low" | "feedback" | "transcript";
export type AttentionReason = "inactive" | "low" | "both";

export const ROLES: { id: RoleId; name: string; short: string }[] = [
  { id: "engineering", name: "Software engineering", short: "Engineering" },
  { id: "sales", name: "Sales & business development", short: "Sales" },
  { id: "product", name: "Product management", short: "Product" },
  { id: "design", name: "Product design", short: "Design" },
];

export const RECRUITERS: { id: string; name: string; roles: RoleId[] }[] = [
  { id: "as", name: "Aditi Sharma", roles: ["engineering", "product"] },
  { id: "ks", name: "Kabir Singh", roles: ["sales", "design"] },
  { id: "ni", name: "Neha Iyer", roles: ["engineering", "sales"] },
  { id: "pn", name: "Priya Nair", roles: ["design", "product"] },
  { id: "rm", name: "Rahul Mehta", roles: ["sales", "engineering"] },
  { id: "sq", name: "Sana Qureshi", roles: [] },
  { id: "vk", name: "Vikram Kumar", roles: ["product"] },
];

/** Month keys, oldest first. The first month only feeds the matured funnel cohort for the second. */
export const MONTHS = [
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
] as const;
export type Month = (typeof MONTHS)[number];
/** Months offered in the period filter, newest first. */
export const SELECTABLE_MONTHS: Month[] = MONTHS.slice(1).reverse();

export const FLAG_LABEL: Record<FlagType, string> = {
  too_high: "Score too high",
  too_low: "Score too low",
  feedback: "Feedback inaccurate",
  transcript: "Transcript wrong",
};

/** One recruiter's invitation cohort for one role, invited during one month. Units: candidates. */
export type Cohort = {
  invited: number;
  activated: number;
  practiced: number;
  repeated: number;
};

export type RoleMonth = {
  /** Pairs reaching 85+ for the first time during the month. */
  newlyReady: number;
  /** Assessed pairs not yet ready at the start of the month (readiness-rate denominator). */
  notReadyAtStart: number;
  /** Days from first completed practice to first 85+ session, one entry per newly ready pair. */
  readyDays: number[];
  /** Pairs whose first practice was 60–90 days before cutoff, and how many reached 85+ within 60 days. */
  attainment: { eligible: number; reached: number };
  /** Latest completed session per pair, as of month end. */
  bands: Record<Band, number>;
  unassessed: number;
  /** Assessed pairs with 2+ completed sessions. */
  twoPlus: number;
  /** Pairs with a fresh-question comparison; both gains are measured on these same pairs. */
  comparable: { pairs: number; overallGain: number; freshGain: number };
  /** Average first-attempt dimension score, 0–100. */
  dims: Record<DimensionId, number>;
  sessions: { started: number; completed: number };
  flags: {
    byType: Record<FlagType, number>;
    resolutionHours: number[];
    unresolved: number;
  };
  /** Current needs-attention pairs at month end. Interview-ready pairs are excluded from the inactivity rule. */
  attention: {
    recruiterId: string;
    reason: AttentionReason;
    waitingDays: number;
  }[];
};

export type RecruiterMonth = {
  invites: number;
  assignments: number;
  contentEdits: number;
};

export type ExecutiveData = {
  cohorts: Record<Month, Record<string, Partial<Record<RoleId, Cohort>>>>;
  roleMonths: Record<Month, Record<RoleId, RoleMonth>>;
  recruiterMonths: Record<Month, Record<string, RecruiterMonth>>;
};

// ---------------------------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROLE_PARAMS: Record<
  RoleId,
  {
    invites: number;
    act: number;
    prac: number;
    rep: number;
    pairs: number;
    ready: number;
    ttr: number;
    attain: number;
    gain: number;
    fresh: number;
    dims: Record<DimensionId, number>;
  }
> = {
  engineering: {
    invites: 140,
    act: 0.8,
    prac: 0.76,
    rep: 0.62,
    pairs: 150,
    ready: 0.27,
    ttr: 24,
    attain: 0.46,
    gain: 16.8,
    fresh: 11.4,
    dims: { content: 74, structure: 57, delivery: 66, relevance: 80 },
  },
  sales: {
    invites: 110,
    act: 0.77,
    prac: 0.72,
    rep: 0.58,
    pairs: 115,
    ready: 0.23,
    ttr: 27,
    attain: 0.4,
    gain: 14.6,
    fresh: 7.1,
    dims: { content: 71, structure: 61, delivery: 72, relevance: 74 },
  },
  product: {
    invites: 80,
    act: 0.81,
    prac: 0.78,
    rep: 0.66,
    pairs: 82,
    ready: 0.29,
    ttr: 22,
    attain: 0.5,
    gain: 18.1,
    fresh: 12.6,
    dims: { content: 77, structure: 59, delivery: 68, relevance: 81 },
  },
  design: {
    invites: 60,
    act: 0.78,
    prac: 0.71,
    rep: 0.6,
    pairs: 64,
    ready: 0.24,
    ttr: 26,
    attain: 0.42,
    gain: 15.2,
    fresh: 9.8,
    dims: { content: 72, structure: 62, delivery: 64, relevance: 77 },
  },
};

const RECRUITER_SKILL: Record<string, number> = {
  as: 1.03,
  ks: 0.9,
  ni: 1,
  pn: 1.06,
  rm: 0.97,
  sq: 1,
  vk: 0.95,
};

/** Vikram is away in October; Sana rarely uses the product. Away recruiters take no actions at all. */
function isAway(recruiterId: string, month: Month, m: number) {
  return (
    (recruiterId === "vk" && month === "2026-10") ||
    (recruiterId === "sq" && m % 3 !== 1)
  );
}

function generate(): ExecutiveData {
  const rand = mulberry32(20261031);
  const jitter = (v: number, pct: number) => v * (1 + (rand() * 2 - 1) * pct);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const cohorts = {} as ExecutiveData["cohorts"];
  const roleMonths = {} as ExecutiveData["roleMonths"];
  const recruiterMonths = {} as ExecutiveData["recruiterMonths"];

  MONTHS.forEach((month, m) => {
    const t = m / (MONTHS.length - 1); // 0 → 1 across the window
    const vol = 0.6 + 0.4 * t;

    // Invitation cohorts: recruiter × role.
    cohorts[month] = {};
    for (const r of RECRUITERS) {
      cohorts[month][r.id] = {};
      for (const roleId of r.roles) {
        const p = ROLE_PARAMS[roleId];
        const share = RECRUITERS.filter((x) => x.roles.includes(roleId)).length;
        const skill = RECRUITER_SKILL[r.id];
        const invited = isAway(r.id, month, m)
          ? 0
          : Math.round(jitter((p.invites / share) * vol, 0.12));
        const activated = Math.round(
          invited * clamp01(jitter(p.act * skill - (1 - t) * 0.07, 0.04)),
        );
        const practiced = Math.round(
          activated * clamp01(jitter(p.prac * skill - (1 - t) * 0.09, 0.05)),
        );
        const repeated = Math.round(
          practiced * clamp01(jitter(p.rep * skill - (1 - t) * 0.08, 0.06)),
        );
        cohorts[month][r.id][roleId] = {
          invited,
          activated,
          practiced,
          repeated,
        };
      }
    }

    // Role snapshots.
    roleMonths[month] = {} as Record<RoleId, RoleMonth>;
    for (const role of ROLES) {
      const p = ROLE_PARAMS[role.id];
      const total = Math.round(jitter(p.pairs * vol, 0.04));
      const unassessed = Math.round(total * (0.14 - 0.03 * t));
      const assessed = total - unassessed;
      const ready = Math.round(assessed * (p.ready - (1 - t) * 0.09));
      const nearly = Math.round(assessed * 0.31);
      const developing = Math.round(assessed * (0.27 + (1 - t) * 0.05));
      const notReady = Math.max(0, assessed - ready - nearly - developing);
      const newlyReady = Math.max(
        1,
        Math.round(jitter(assessed * (0.075 + 0.05 * t), 0.1)),
      );
      const ttr = p.ttr + (1 - t) * 7;
      const readyDays = Array.from({ length: newlyReady }, (_, i) =>
        Math.max(
          4,
          Math.round(
            ttr * (0.5 + (i / Math.max(1, newlyReady - 1)) * 1.1) +
              (rand() * 4 - 2),
          ),
        ),
      );
      const eligible = Math.round(assessed * 0.42);
      const twoPlus = Math.round(assessed * (0.52 + 0.12 * t));
      const started = Math.round(jitter(assessed * 2.2 * vol, 0.05));
      const completed = Math.round(
        started * clamp01(0.76 + 0.09 * t + (rand() * 0.02 - 0.01)),
      );
      const flagTotal = Math.round(completed * (0.042 - 0.016 * t));
      const flagWeights: [FlagType, number][] = [
        ["too_high", 0.36],
        ["too_low", 0.19],
        ["feedback", 0.3],
        ["transcript", 0.15],
      ];
      const byType = Object.fromEntries(
        flagWeights.map(([k, w]) => [
          k,
          Math.round(flagTotal * jitter(w, 0.2)),
        ]),
      ) as Record<FlagType, number>;
      const flagCount = Object.values(byType).reduce((a, b) => a + b, 0);
      const owners = RECRUITERS.filter((r) => r.roles.includes(role.id));
      const attentionCount = Math.round(assessed * (0.13 - 0.04 * t));

      roleMonths[month][role.id] = {
        newlyReady,
        notReadyAtStart: assessed - ready + newlyReady,
        readyDays,
        attainment: {
          eligible,
          reached: Math.round(eligible * clamp01(p.attain - (1 - t) * 0.1)),
        },
        bands: { ready, nearly, developing, not_ready: notReady },
        unassessed,
        twoPlus,
        comparable: {
          pairs: Math.round(twoPlus * 0.7),
          overallGain: Number(jitter(p.gain - (1 - t) * 3, 0.04).toFixed(1)),
          freshGain: Number(jitter(p.fresh - (1 - t) * 3.2, 0.06).toFixed(1)),
        },
        dims: Object.fromEntries(
          (Object.keys(p.dims) as DimensionId[]).map((d) => [
            d,
            Math.round(jitter(p.dims[d] - (1 - t) * 4, 0.02)),
          ]),
        ) as Record<DimensionId, number>,
        sessions: { started, completed },
        flags: {
          byType,
          resolutionHours: Array.from({ length: flagCount }, () =>
            Math.round(jitter(26 - 9 * t, 0.6)),
          ),
          unresolved: Math.round(flagCount * 0.12),
        },
        attention: Array.from({ length: attentionCount }, () => {
          const x = rand();
          return {
            recruiterId: owners[Math.floor(rand() * owners.length)].id,
            reason: (x < 0.5
              ? "inactive"
              : x < 0.85
                ? "low"
                : "both") as AttentionReason,
            waitingDays: 1 + Math.floor(rand() * 24),
          };
        }),
      };
    }

    // Recruiter actions.
    recruiterMonths[month] = {};
    for (const r of RECRUITERS) {
      const invites = Object.values(cohorts[month][r.id]).reduce(
        (n, c) => n + (c?.invited ?? 0),
        0,
      );
      recruiterMonths[month][r.id] = isAway(r.id, month, m)
        ? { invites: 0, assignments: 0, contentEdits: 0 }
        : {
            invites,
            assignments: Math.round(invites * 1.1),
            contentEdits: r.id === "sq" ? 2 : Math.floor(rand() * 9),
          };
    }
  });

  return { cohorts, roleMonths, recruiterMonths };
}

export const EXECUTIVE_DATA: ExecutiveData = generate();

/** Hardest question per role: lowest first-attempt average (mock). */
export const HARDEST_QUESTION: Record<
  RoleId,
  { text: string; first: number; retry: number; responses: number }
> = {
  engineering: {
    text: "Tell me about a time you influenced a difficult technical decision.",
    first: 48,
    retry: 64,
    responses: 36,
  },
  sales: {
    text: "Walk me through a deal you lost and what you changed afterwards.",
    first: 51,
    retry: 66,
    responses: 29,
  },
  product: {
    text: "Describe a time you said no to a senior stakeholder.",
    first: 49,
    retry: 63,
    responses: 22,
  },
  design: {
    text: "How did you handle research that contradicted the brief?",
    first: 52,
    retry: 67,
    responses: 18,
  },
};

/** One fictional person with one assigned role; invitation counts therefore deduplicate people. */
export type CandidatePerformance = {
  id: string;
  name: string;
  recruiterId: string;
  roleId: RoleId;
  invitedMonth: Month;
  accepted: boolean;
  sessions: number;
  firstScore: number | null;
  latestScore: number | null;
};

const FIRST_NAMES = [
  "Ananya",
  "Rohan",
  "Meera",
  "Dev",
  "Ishaan",
  "Kavya",
  "Arjun",
  "Diya",
  "Nikhil",
  "Tara",
  "Aarav",
  "Sia",
  "Rehan",
  "Myra",
  "Vihaan",
  "Anika",
];
const LAST_NAMES = [
  "Rao",
  "Patel",
  "Joshi",
  "Kapoor",
  "Shah",
  "Menon",
  "Gupta",
  "Das",
  "Bose",
  "Verma",
  "Singh",
  "Nair",
  "Jain",
  "Seth",
  "Bhat",
  "Iyer",
];

/**
 * Expand the invitation cohorts into deterministic individual records for the primary views.
 * Accepted = first sign-in within 7 days. Scores are measured through the end of the next month.
 * Each record has at most one later score; single-session candidates remain explicitly unpaired.
 */
export const CANDIDATE_PERFORMANCE: CandidatePerformance[] = MONTHS.flatMap(
  (month, mi) =>
    RECRUITERS.flatMap((recruiter, ri) =>
      recruiter.roles.flatMap((roleId, roleIndex) => {
        const c = EXECUTIVE_DATA.cohorts[month][recruiter.id][roleId];
        if (!c) return [];
        return Array.from({ length: c.invited }, (_, i) => {
          const seed = mi * 13 + ri * 7 + roleIndex * 3 + i;
          const sessions =
            i < c.repeated ? 2 + (seed % 3) : i < c.practiced ? 1 : 0;
          const first = sessions ? 39 + (seed % 36) : null;
          const gain =
            seed % 11 === 0
              ? -4 - (seed % 5)
              : seed % 7 === 0
                ? 0
                : 9 + (seed % 19);
          return {
            id: `${month}-${recruiter.id}-${roleId}-${i + 1}`,
            name: `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length]}`,
            recruiterId: recruiter.id,
            roleId,
            invitedMonth: month,
            accepted: i < c.activated,
            sessions,
            firstScore: first,
            latestScore:
              sessions >= 2 && first != null
                ? Math.min(100, first + gain)
                : null,
          };
        });
      }),
    ),
);
