import { PageHeader } from "@/components/layout/page-header";

export function SessionSkeleton() {
  return (
    <div aria-busy="true">
      <PageHeader title="Session review" breadcrumb={[{ label: "Candidates", href: "/candidates" }, { label: "Loading" }]} />
      <div className="h-16 animate-pulse rounded-md bg-neutral-soft" />
      <div className="mt-6 grid gap-6 min-[1025px]:grid-cols-[232px_minmax(0,1fr)_280px]">
        <div className="h-64 animate-pulse rounded-md bg-neutral-soft" />
        <div className="h-96 animate-pulse rounded-md bg-neutral-soft" />
        <div className="h-64 animate-pulse rounded-md bg-neutral-soft" />
      </div>
      <p className="sr-only" role="status">Loading session</p>
    </div>
  );
}
