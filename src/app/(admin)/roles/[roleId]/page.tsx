import { Suspense } from "react";
import { redirect } from "next/navigation";

// The role editor layout renders this page only once the role has loaded on the client, so it is
// never in the server render that instant-navigation validation checks.
export const instant = false;

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
