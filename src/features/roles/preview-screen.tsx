"use client";

import { Fragment } from "react";
import { FlashCardPreview } from "@/components/media/flash-card-preview";
import { CARD_CATEGORY_LABEL } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useRoleChanged } from "@/lib/role-events";
import { listFlashCards, listQuestions } from "@/services/roles";
import { useRole } from "./role-context";

export function PreviewScreen() {
  const role = useRole();
  const cards = useAsync(() => listFlashCards(role.id), [role.id]);
  const questions = useAsync(() => listQuestions(role.id), [role.id]);
  useRoleChanged(role.id, () => {
    cards.reload();
    questions.reload();
  });

  const approvedCards = (cards.data ?? []).filter((c) => c.status === "approved");
  const approvedQuestions = (questions.data ?? []).filter((q) => q.status === "approved");
  const loading = cards.loading && !cards.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-semibold leading-6 text-ink">Preview as candidate</h2>
        <p className="m-0 text-sm text-ink-muted">
          This is the approved content candidates will see. AI drafts are never shown here. Later this tab will reuse the
          candidate app screens.
        </p>
      </div>

      <section aria-labelledby="pv-cards" className="flex flex-col gap-3">
        <h3 id="pv-cards" className="m-0 text-sm font-semibold text-ink">
          Flash cards ({approvedCards.length})
        </h3>
        {loading ? (
          <p className="m-0 text-sm text-ink-muted">Loading…</p>
        ) : approvedCards.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">No approved flash cards yet. Approve a card on the Flash cards tab to see it here.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {approvedCards.map((c, i) => (
              <li key={c.id} className="flex flex-wrap gap-4">
                {(["front", "back"] as const).map((side) => (
                  <Fragment key={side}>
                    <FlashCardPreview
                      side={side}
                      category={CARD_CATEGORY_LABEL[c.category]}
                      question={c.question}
                      strong={c.strongAnswerPoints}
                      tip={c.tip}
                      mistakes={c.commonMistakes}
                      index={i + 1}
                      total={approvedCards.length}
                    />
                  </Fragment>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pv-questions" className="flex flex-col gap-3">
        <h3 id="pv-questions" className="m-0 text-sm font-semibold text-ink">
          Questions ({approvedQuestions.length})
        </h3>
        {approvedQuestions.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">
            {questions.loading && !questions.data ? "Loading…" : "No approved questions yet."}
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {approvedQuestions.map((q, i) => (
              <li key={q.id} className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink">
                <span className="mr-2 text-ink-muted">{i + 1}.</span>
                {q.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
