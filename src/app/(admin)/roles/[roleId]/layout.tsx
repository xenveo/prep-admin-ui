import { Suspense, type ReactNode } from "react";
import { PageContainer } from "@/components/layout/page-header";
import { RoleEditorShell } from "@/features/roles/role-editor-shell";

async function ShellWithParams({ params, children }: { params: Promise<{ roleId: string }>; children: ReactNode }) {
  const { roleId } = await params;
  return <RoleEditorShell roleId={roleId}>{children}</RoleEditorShell>;
}

export default function RoleLayout(props: LayoutProps<"/roles/[roleId]">) {
  return (
    <Suspense fallback={<PageContainer><div aria-busy="true" className="h-7 w-72 rounded-sm bg-neutral-soft" /></PageContainer>}>
      <ShellWithParams params={props.params}>{props.children}</ShellWithParams>
    </Suspense>
  );
}
