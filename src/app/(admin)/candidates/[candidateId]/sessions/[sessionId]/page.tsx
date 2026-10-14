import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-header";
import { SessionScreen } from "@/features/sessions/session-screen";
import { SessionSkeleton } from "@/features/sessions/session-skeleton";

async function SessionRoute({ params }: Pick<PageProps<"/candidates/[candidateId]/sessions/[sessionId]">, "params">) {
  const { candidateId, sessionId } = await params;
  return <SessionScreen candidateId={candidateId} sessionId={sessionId} />;
}

export default function Page(props: PageProps<"/candidates/[candidateId]/sessions/[sessionId]">) {
  return (
    <PageContainer>
      <Suspense fallback={<SessionSkeleton />}>
        <SessionRoute params={props.params} />
      </Suspense>
    </PageContainer>
  );
}
