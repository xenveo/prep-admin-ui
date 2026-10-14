import { cn } from "@/lib/cn";

/** Candidate-app card preview (12px radius, 20px padding). */
export function FlashCardPreview({
  side,
  category,
  question,
  strong,
  tip,
  mistakes,
  index,
  total,
}: {
  side: "front" | "back";
  category: string;
  question: string;
  strong: string[];
  tip: string;
  mistakes: string[];
  index?: number;
  total?: number;
}) {
  const position = index != null && total != null ? ` · Card ${index} of ${total}` : "";
  return (
    <div
      role="group"
      aria-label={`Flash card ${side}: ${category}`}
      className={cn("flex w-full max-w-[320px] flex-col gap-2.5 rounded-card border border-line bg-surface p-5")}
    >
      <span className="inline-flex h-[22px] items-center self-start rounded-full bg-primary-soft px-2 text-[12px] font-semibold text-primary-text">
        {category}
      </span>
      {side === "front" ? (
        <>
          <p className="m-0 text-[18px] font-semibold leading-[26px] text-ink">{question}</p>
          <span className="text-[12px] text-ink-muted">Tap to flip{position}</span>
        </>
      ) : (
        <>
          <p className="m-0 text-[13px] font-semibold leading-5 text-ink-muted">{question}</p>
          <section className="flex flex-col gap-1">
            <h4 className="m-0 text-[13px] font-semibold text-primary-text">A strong answer</h4>
            <ul className="m-0 list-disc pl-5 text-[13px] leading-5 text-ink">
              {strong.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
          <p className="m-0 rounded-md bg-primary-tint p-2.5 text-[13px] leading-5 text-ink">
            <span className="font-semibold">Tip: </span>
            {tip}
          </p>
          <section className="flex flex-col gap-1">
            <h4 className="m-0 text-[13px] font-semibold text-improve-text">Common mistakes</h4>
            <ul className="m-0 list-disc pl-5 text-[13px] leading-5 text-ink">
              {mistakes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
          <span className="text-[12px] text-ink-muted">Tap to flip back{position}</span>
        </>
      )}
    </div>
  );
}
