import { EmptyState } from "@/components/ui/empty-state";

export function SuperAdminNotice({ what }: { what: string }) {
  return (
    <section className="rounded-panel border border-line bg-surface">
      <EmptyState
        icon="lock"
        title={`Only super admins can ${what}`}
        description="Ask a super admin to make changes here, or to give you super admin access."
        className="py-12"
      />
    </section>
  );
}
