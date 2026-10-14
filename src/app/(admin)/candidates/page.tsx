import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CandidatesScreen } from "@/features/candidates/candidates-screen";

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <PageHeader title="Candidates" description="Invite people and track how prepared they are." />
        </PageContainer>
      }
    >
      <CandidatesScreen />
    </Suspense>
  );
}
