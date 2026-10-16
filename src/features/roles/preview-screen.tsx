"use client";

import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FlashCardPreview } from "@/components/media/flash-card-preview";
import { CARD_CATEGORY_LABEL } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useRoleChanged } from "@/lib/role-events";
import { listFlashCards, listQuestions } from "@/services/roles";
import { useRole } from "./role-context";

const EYEBROW = "m-0 font-mono text-xs leading-4 font-medium tracking-[0.08em] text-ink-faint uppercase";

function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm text-ink-muted">{children}</p>;
}

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
  const cardsLoading = cards.loading && !cards.data;
  const questionsLoading = questions.loading && !questions.data;

  return (
    <div className="flex flex-col gap-7">
      <section
        aria-labelledby="pv-title"
        className="flex flex-wrap items-center gap-4 rounded-panel border border-line bg-surface px-6 py-5"
      >
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <h2 id="pv-title" className="m-0 text-base leading-6 font-semibold text-ink">
            Preview as candidate
          </h2>
          <p className="m-0 text-sm text-ink-muted">
            This is the approved content candidates see. Test interviews are excluded from candidate statistics.
          </p>
        </div>
        <ButtonLink
          href={`/roles/${encodeURIComponent(role.id)}/test`}
          variant="primary"
          className="h-11! px-[18px]!"
          disabled={role.status === "archived"}
        >
          Start test interview →
        </ButtonLink>
      </section>

      {(cards.error || questions.error) && (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm text-error">
          <p className="m-0">{cards.error?.message ?? questions.error?.message}</p>
          <Button onClick={() => { cards.reload(); questions.reload(); }}>Reload content</Button>
        </div>
      )}

      <section aria-labelledby="pv-cards" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="pv-cards" className={EYEBROW}>
            Flash cards · {approvedCards.length}
          </h3>
          {approvedCards.length > 0 ? <span className="text-xs text-ink-faint">Click a card to flip it</span> : null}
        </div>
        {cardsLoading ? (
          <Note>Loading…</Note>
        ) : cards.error && !cards.data ? null : approvedCards.length === 0 ? (
          <Note>No approved flash cards yet. Approve a card on the Flash cards tab to see it here.</Note>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
            {approvedCards.map((c, i) => (
              <li key={c.id} className="flex">
                <FlashCardPreview
                  variant="grid"
                  side="front"
                  category={CARD_CATEGORY_LABEL[c.category]}
                  question={c.question}
                  strong={c.strongAnswerPoints}
                  tip={c.tip}
                  mistakes={c.commonMistakes}
                  outline={c.sampleAnswerOutline}
                  index={i + 1}
                  total={approvedCards.length}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pv-questions" className="flex flex-col gap-3">
        <h3 id="pv-questions" className={EYEBROW}>
          Interview questions · {approvedQuestions.length}
        </h3>
        {questions.error && !questions.data ? null : approvedQuestions.length === 0 ? (
          <Note>{questionsLoading ? "Loading…" : "No approved questions yet."}</Note>
        ) : (
          <ol className="m-0 list-none rounded-panel border border-line bg-surface p-0">
            {approvedQuestions.map((q, i) => (
              <li
                key={q.id}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0"
              >
                <span aria-hidden="true" className="font-mono text-xs text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-ink">{q.text}</span>
                <span className="text-xs text-ink-faint">{CARD_CATEGORY_LABEL[q.category]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
