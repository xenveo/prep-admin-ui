/** Job role, flash card and question services (A4 to A7). */
import { bandForScore } from "@/lib/bands";
import {
  TIP_MAX_LENGTH,
  type ApproveRequirements,
  type FlashCard,
  type FlashCardInput,
  type JobRole,
  type Question,
  type QuestionInput,
  type RoleInput,
  type RolePatch,
  type SubScores,
  type TestEvaluation,
} from "@/lib/types";
import { respond } from "@/services/latency";
import { answerScore, weightsValid } from "@/services/scoring";
import {
  addAudit,
  countRubricQuestions,
  currentAdmin,
  findRole,
  getStore,
  nextId,
  roleView,
  stamp,
  touchRole,
} from "@/services/store";

const MIN_RUBRIC_QUESTIONS = 5;

export function listRoles(): Promise<JobRole[]> {
  return respond(() => getStore().roles.map(roleView));
}

export function getRole(id: string): Promise<JobRole> {
  return respond(() => roleView(findRole(id)));
}

export function updateRole(id: string, patch: RolePatch): Promise<JobRole> {
  return respond(() => {
    const role = findRole(id);
    if (role.status === "archived") throw new Error("Archived roles can't be edited");
    if (patch.title !== undefined && patch.title.trim() === "") throw new Error("Role title is required");
    if (patch.settings) {
      if (!weightsValid(patch.settings.sessionWeights)) throw new Error("Session score weights must add up to 100%");
      if (!weightsValid(patch.settings.dimensionWeights)) throw new Error("Answer dimension weights must add up to 100%");
    }
    Object.assign(role, {
      ...(patch.title !== undefined && { title: patch.title.trim() }),
      ...(patch.seniority !== undefined && { seniority: patch.seniority }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.keySkills !== undefined && { keySkills: patch.keySkills }),
      ...(patch.settings !== undefined && { settings: patch.settings }),
    });
    touchRole(role);
    addAudit("Edited role", role.title, role.id);
    return roleView(role);
  });
}

function computeRequirements(roleId: string): ApproveRequirements {
  const s = getStore();
  const role = findRole(roleId);
  const view = roleView(role);
  const rubricCount = countRubricQuestions(s.questions.filter((q) => q.roleId === roleId)) + role.offsets.rubric;
  const requirements = [
    { id: "questions", label: `Add at least ${MIN_RUBRIC_QUESTIONS} questions with rubrics`, met: rubricCount >= MIN_RUBRIC_QUESTIONS },
    { id: "session-weights", label: "Make the session score weights add up to 100%", met: weightsValid(role.settings.sessionWeights) },
    { id: "dimension-weights", label: "Make the answer dimension weights add up to 100%", met: weightsValid(role.settings.dimensionWeights) },
  ];
  const firstUnmet = requirements.find((r) => !r.met)?.label ?? null;
  return {
    canApprove: firstUnmet === null,
    firstUnmet,
    requirements,
    approvedFlashCards: view.flashCardCount - view.aiDraftCardCount,
    approvedQuestions: view.questionCount - view.aiDraftQuestionCount,
    candidatesToNotify: view.candidatesAssigned,
  };
}

/** First unmet requirement plus the full checklist (and counts for the approve dialog). */
export function getApproveRequirements(roleId: string): Promise<ApproveRequirements> {
  return respond(() => computeRequirements(roleId));
}

/** Draft -> approved. Rejects with the first unmet requirement. Returns how many candidates get the email. */
export function approveRole(id: string): Promise<{ role: JobRole; notified: number }> {
  return respond(() => {
    const role = findRole(id);
    if (role.status !== "draft") throw new Error("Only a draft role can be approved");
    const req = computeRequirements(id);
    if (!req.canApprove) throw new Error(req.firstUnmet ?? "Requirements not met");
    role.status = "approved";
    touchRole(role);
    addAudit("Approved role", role.title, role.id);
    return { role: roleView(role), notified: req.candidatesToNotify };
  });
}

/** Approved or draft -> archived. Scores are kept. */
export function archiveRole(id: string): Promise<JobRole> {
  return respond(() => {
    const role = findRole(id);
    if (role.status === "archived") throw new Error("Role is already archived");
    role.status = "archived";
    touchRole(role);
    addAudit("Archived role", role.title, role.id);
    return roleView(role);
  });
}

export function createRole(input: RoleInput): Promise<JobRole> {
  return respond(() => {
    if (input.title.trim() === "") throw new Error("Role title is required");
    const s = getStore();
    const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "role";
    const id = s.roles.some((r) => r.id === `role_${slug}`) ? nextId(`role_${slug}`) : `role_${slug}`;
    s.roles.push({
      id,
      title: input.title.trim(),
      seniority: input.seniority,
      status: "draft",
      description: input.description ?? "",
      keySkills: input.keySkills ?? [],
      settings: {
        questionsPerSession: 5,
        questionOrder: "fixed",
        answerGuideSeconds: 120,
        requireAllCards: true,
        maxSessionsPerCandidate: 5,
        sessionWeights: { firstTry: 20, secondTry: 55, learning: 25 },
        dimensionWeights: { content: 45, structure: 20, delivery: 20, relevance: 15 },
      },
      updatedAt: stamp(),
      updatedBy: currentAdmin().id,
      avgLatestScore: null,
      offsets: { cards: 0, questions: 0, aiCards: 0, aiQuestions: 0, rubric: 0, assigned: 0 },
    });
    addAudit("Created role", input.title.trim(), id);
    return roleView(findRole(id));
  });
}

// ---------------------------------------------------------------------------
// Flash cards
// ---------------------------------------------------------------------------

function cardsOf(roleId: string): FlashCard[] {
  return getStore()
    .cards.filter((c) => c.roleId === roleId)
    .sort((a, b) => a.position - b.position);
}

function renumber(roleId: string): void {
  cardsOf(roleId).forEach((c, i) => {
    c.position = i + 1;
  });
}

export function listFlashCards(roleId: string): Promise<FlashCard[]> {
  return respond(() => {
    findRole(roleId);
    return cardsOf(roleId);
  });
}

/** Create (no id) or update a card. Tip is limited to 90 characters. */
export function saveFlashCard(roleId: string, input: FlashCardInput): Promise<FlashCard> {
  return respond(() => {
    const role = findRole(roleId);
    if (input.tip.length > TIP_MAX_LENGTH) throw new Error(`Tip must be ${TIP_MAX_LENGTH} characters or fewer`);
    const s = getStore();
    let card = input.id ? s.cards.find((c) => c.id === input.id && c.roleId === roleId) : undefined;
    if (input.id && !card) throw new Error(`Flash card not found: ${input.id}`);
    const fields = {
      category: input.category,
      question: input.question,
      strongAnswerPoints: input.strongAnswerPoints,
      tip: input.tip,
      commonMistakes: input.commonMistakes,
    };
    if (card) {
      Object.assign(card, fields);
    } else {
      card = {
        id: nextId("card"),
        roleId,
        position: cardsOf(roleId).length + 1,
        ...fields,
        status: input.status ?? "approved",
        createdBy: currentAdmin().id,
      };
      s.cards.push(card);
    }
    touchRole(role);
    return card;
  });
}

export function reorderFlashCards(roleId: string, orderedIds: string[]): Promise<FlashCard[]> {
  return respond(() => {
    findRole(roleId);
    const current = cardsOf(roleId);
    if (orderedIds.length !== current.length || !current.every((c) => orderedIds.includes(c.id))) {
      throw new Error("Reorder must list every card exactly once");
    }
    orderedIds.forEach((id, i) => {
      current.find((c) => c.id === id)!.position = i + 1;
    });
    touchRole(findRole(roleId));
    return cardsOf(roleId);
  });
}

export function approveFlashCard(cardId: string): Promise<FlashCard> {
  return respond(() => {
    const card = getStore().cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Flash card not found: ${cardId}`);
    card.status = "approved";
    card.approvedBy = currentAdmin().id;
    card.approvedAt = stamp();
    touchRole(findRole(card.roleId));
    return card;
  });
}

/** Delete an AI draft (never shown to candidates). Approved cards can't be discarded here. */
export function discardFlashCard(cardId: string): Promise<void> {
  return respond(() => {
    const s = getStore();
    const card = s.cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Flash card not found: ${cardId}`);
    if (card.status !== "ai_draft") throw new Error("Only AI drafts can be discarded");
    s.cards = s.cards.filter((c) => c.id !== cardId);
    renumber(card.roleId);
    touchRole(findRole(card.roleId));
  });
}

/** STUB: pretends to call AI and appends three role-generic drafts. */
export function draftFlashCardsWithAI(roleId: string): Promise<FlashCard[]> {
  return respond(
    () => {
      const role = findRole(roleId);
      const s = getStore();
      const base = cardsOf(roleId).length;
      const title = role.title;
      const drafts: Omit<FlashCard, "id" | "roleId" | "position">[] = [
        {
          category: "motivation",
          question: `What draws you to work as a ${title}?`,
          strongAnswerPoints: ["A specific reason grounded in experience", "Links the reason to the day-to-day work"],
          tip: "Be specific about what draws you in.",
          commonMistakes: ["Giving a general answer that would fit any job"],
          status: "ai_draft",
          createdBy: "ai",
        },
        {
          category: "behavioural",
          question: "Tell me about a time you learned something new quickly.",
          strongAnswerPoints: ["Sets out the situation and what was at stake", "Describes what you did, step by step", "Ends with a clear result"],
          tip: "Use a real example and end with the result.",
          commonMistakes: ["Skipping the result", "Describing what the team did instead of what you did"],
          status: "ai_draft",
          createdBy: "ai",
        },
        {
          category: "situational",
          question: "You have two urgent tasks and time for one. What do you do?",
          strongAnswerPoints: ["Explains how you decide what comes first", "Mentions telling the people affected"],
          tip: "Say how you decide, then what you do.",
          commonMistakes: ["Saying you would do both at once"],
          status: "ai_draft",
          createdBy: "ai",
        },
      ];
      const created = drafts.map((d, i): FlashCard => ({ ...d, id: nextId("card"), roleId, position: base + i + 1 }));
      s.cards.push(...created);
      touchRole(role);
      addAudit("Drafted flash cards with AI", title, roleId);
      return created;
    },
    900,
  );
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export function listQuestions(roleId: string): Promise<Question[]> {
  return respond(() => {
    findRole(roleId);
    return getStore().questions.filter((q) => q.roleId === roleId);
  });
}

/** Create (no id) or update a question and its rubric. */
export function saveQuestion(roleId: string, input: QuestionInput): Promise<Question> {
  return respond(() => {
    const role = findRole(roleId);
    if (input.text.trim() === "") throw new Error("Question text is required");
    const s = getStore();
    let q = input.id ? s.questions.find((x) => x.id === input.id && x.roleId === roleId) : undefined;
    if (input.id && !q) throw new Error(`Question not found: ${input.id}`);
    const fields = { text: input.text.trim(), category: input.category, difficulty: input.difficulty, rubric: input.rubric };
    if (q) {
      Object.assign(q, fields, input.status ? { status: input.status } : {});
    } else {
      q = {
        id: nextId("q"),
        roleId,
        ...fields,
        status: input.status ?? "approved",
        timesAsked: 0,
        avgFirstTry: null,
        avgSecondTry: null,
        avgLearning: null,
      };
      s.questions.push(q);
    }
    touchRole(role);
    return q;
  });
}

/**
 * STUB: returns a sample evaluation. The fixture result is returned for the sample question (q1);
 * other questions get a deterministic result from the answer length. Never stored on a candidate.
 */
export function evaluateSampleAnswer(questionId: string, answer: string): Promise<TestEvaluation> {
  return respond(
    () => {
      const q = getStore().questions.find((x) => x.id === questionId);
      if (!q) throw new Error(`Question not found: ${questionId}`);
      if (answer.trim() === "") throw new Error("Type a sample answer first");
      if (q.sampleEvaluation) return { ...q.sampleEvaluation, answer };
      const words = answer.trim().split(/\s+/).length;
      const lift = Math.min(30, Math.floor(words / 2));
      const sub: SubScores = { content: 45 + lift, structure: 40 + lift, delivery: 55 + Math.floor(lift / 2), relevance: 55 + lift };
      const score = answerScore(sub);
      const matched = q.rubric.keyPoints.slice(0, words >= 30 ? 3 : 1).map((k) => k.point.toLowerCase());
      return {
        answer,
        score,
        band: bandForScore(score),
        subScores: sub,
        matched,
        issues: words < 30 ? ["answer is short, so the rubric points are hard to find"] : [],
        candidateFeedback: "Sample feedback. The real feedback comes from the AI evaluation once it is connected.",
        isTest: true,
      };
    },
    700,
  );
}
