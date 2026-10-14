import { Suspense } from "react";
import { CardsScreen } from "@/features/role-content/cards-screen";

async function Screen({ params }: Pick<PageProps<"/roles/[roleId]/cards">, "params">) {
  const { roleId } = await params;
  return <CardsScreen roleId={roleId} />;
}

export default function Page(props: PageProps<"/roles/[roleId]/cards">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading flash cards…</p>}>
      <Screen params={props.params} />
    </Suspense>
  );
}
