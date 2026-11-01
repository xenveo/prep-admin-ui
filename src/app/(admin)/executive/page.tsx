import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { ExecutiveScreen } from "@/features/executive/executive-screen";

export default function Page() {
  return (
    <PageContainer>
      <Suspense
        fallback={
          <PageHeader
            title="Executive overview"
            description="Recruiter results and candidate progress."
          />
        }
      >
        <ExecutiveScreen />
      </Suspense>
    </PageContainer>
  );
}
