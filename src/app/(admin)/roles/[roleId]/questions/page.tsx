import { Suspense } from "react";
import { QuestionsScreen } from "@/features/role-content/questions-screen";

// The role editor layout renders this page only once the role has loaded on the client, so it is
// never in the server render that instant-navigation validation checks.
export const instant = false;

async function Screen({ params }: Pick<PageProps<"/roles/[roleId]/questions">, "params">) {
  const { roleId } = await params;
  return <QuestionsScreen roleId={roleId} />;
}

export default function Page(props: PageProps<"/roles/[roleId]/questions">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading questions…</p>}>
      <Screen params={props.params} />
    </Suspense>
  );
}
