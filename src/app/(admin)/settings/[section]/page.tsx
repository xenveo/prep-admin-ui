import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SettingsSection } from "@/features/settings/settings-section";
import { SECTIONS, type SectionKey } from "@/features/settings/sections";

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ section: s.key }));
}

async function Section({ params }: Pick<PageProps<"/settings/[section]">, "params">) {
  const { section } = await params;
  const known = SECTIONS.find((s) => s.key === section);
  if (!known) notFound();
  return <SettingsSection section={known.key as SectionKey} />;
}

export default function Page(props: PageProps<"/settings/[section]">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="h-40" />}>
      <Section params={props.params} />
    </Suspense>
  );
}
