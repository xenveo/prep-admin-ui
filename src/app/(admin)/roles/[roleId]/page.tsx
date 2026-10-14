import { Suspense } from "react";
import { redirect } from "next/navigation";

async function RedirectToDetails({ params }: Pick<PageProps<"/roles/[roleId]">, "params">): Promise<null> {
  const { roleId } = await params;
  redirect(`/roles/${encodeURIComponent(roleId)}/details`);
}

export default function Page(props: PageProps<"/roles/[roleId]">) {
  return (
    <Suspense fallback={null}>
      <RedirectToDetails params={props.params} />
    </Suspense>
  );
}
