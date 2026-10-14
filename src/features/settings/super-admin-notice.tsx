import { EmptyState } from "@/components/ui/empty-state";

export function SuperAdminNotice({ what }: { what: string }) {
  return (
    <section className="rounded-md border border-line bg-surface py-6">
      <EmptyState
        icon="lock"
        title={`Only super admins can ${what}`}
        description="Ask a super admin to make changes here, or to give you super admin access."
      />
    </section>
  );
}
