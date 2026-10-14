import { PageContainer } from "@/components/layout/page-header";
import { ComponentSheet } from "@/features/component-sheet/component-sheet";

export const metadata = { title: "Component sheet" };

export default function Page() {
  return (
    <PageContainer>
      <ComponentSheet />
    </PageContainer>
  );
}
