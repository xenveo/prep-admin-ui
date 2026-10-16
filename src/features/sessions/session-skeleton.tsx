import { PageHeader } from "@/components/layout/page-header";

export function SessionSkeleton() {
  return (
    <div aria-busy="true">
      <PageHeader title="Session review" breadcrumb={[{ label: "Candidates", href: "/candidates" }, { label: "Loading" }]} />
      <div className="mb-6 h-[78px] animate-pulse rounded-panel bg-neutral-soft" />
      <div className="grid items-start gap-6 min-[1025px]:grid-cols-[240px_minmax(0,1fr)_280px]">
        <div className="h-80 animate-pulse rounded-card bg-neutral-soft" />
        <div className="h-96 animate-pulse rounded-panel bg-neutral-soft" />
        <div className="h-80 animate-pulse rounded-panel bg-neutral-soft" />
      </div>
      <p className="sr-only" role="status">Loading session</p>
    </div>
  );
}
