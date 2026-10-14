import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { ReportsScreen } from "@/features/reports/reports-screen";

export default function Page() {
  return (
    <PageContainer>
      <Suspense fallback={<PageHeader title="Reports" description="How prepared candidates are, and where they get stuck." />}>
        <ReportsScreen />
      </Suspense>
    </PageContainer>
  );
}
