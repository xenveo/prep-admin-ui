import { Suspense } from "react";
import { CardDraftScreen } from "@/features/role-content/card-draft-screen";

// The role layout loads client-side and provides the authenticated role context.
export const instant = false;

async function Screen({ params, searchParams }: PageProps<"/roles/[roleId]/cards/draft-ai">) {
  const [{ roleId }, query] = await Promise.all([params, searchParams]);
  const batchId = typeof query.batch === "string" ? query.batch : undefined;
  const fresh = query.new === "1";
  return <CardDraftScreen key={`${roleId}:${batchId ?? (fresh ? "new" : "latest")}`} roleId={roleId} batchId={batchId} fresh={fresh} />;
}

export default function Page(props: PageProps<"/roles/[roleId]/cards/draft-ai">) {
  return <Suspense fallback={<p className="text-sm text-ink-muted">Loading drafting page…</p>}><Screen {...props} /></Suspense>;
}
