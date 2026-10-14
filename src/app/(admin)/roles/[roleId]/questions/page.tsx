import { Suspense } from "react";
import { QuestionsScreen } from "@/features/role-content/questions-screen";

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
