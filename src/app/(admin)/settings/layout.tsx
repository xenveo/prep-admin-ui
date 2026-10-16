import { Suspense, type ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <PageContainer className="!max-w-[1200px]">
          <PageHeader title="Settings" className="!mb-7" />
        </PageContainer>
      }
    >
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}
