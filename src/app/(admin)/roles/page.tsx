import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { RolesScreen } from "@/features/roles/roles-screen";

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <PageHeader title="Job roles" description="Candidates only see roles you approve and assign to them." />
        </PageContainer>
      }
    >
      <RolesScreen />
    </Suspense>
  );
}
