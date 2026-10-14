import { Suspense, type ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SettingsShell } from "@/features/settings/settings-shell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <PageHeader title="Settings" />
        </PageContainer>
      }
    >
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}
