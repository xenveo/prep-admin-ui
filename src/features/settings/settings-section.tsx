"use client";

import { AdminsSection } from "./admins-section";
import { AiSection } from "./ai-section";
import { AuditSection } from "./audit-section";
import { EmailSection } from "./email-section";
import { PrivacySection } from "./privacy-section";
import { useSettingsContext } from "./settings-context";
import type { SectionKey } from "./sections";
import { SuperAdminNotice } from "./super-admin-notice";

const GATED_COPY: Record<"admins" | "privacy" | "email", string> = {
  admins: "manage admins",
  privacy: "change data and privacy settings",
  email: "change email settings",
};

export function SettingsSection({ section }: { section: SectionKey }) {
  const { admin } = useSettingsContext();
  if (!admin) return <div aria-busy="true" className="h-40 rounded-md border border-line bg-surface" />;
  const isSuper = admin.access === "super_admin";

  switch (section) {
    case "ai":
      return <AiSection readOnly={!isSuper} />;
    case "audit":
      return <AuditSection />;
    case "admins":
      return isSuper ? <AdminsSection currentAdminId={admin.id} /> : <SuperAdminNotice what={GATED_COPY.admins} />;
    case "privacy":
      return isSuper ? <PrivacySection /> : <SuperAdminNotice what={GATED_COPY.privacy} />;
    case "email":
      return isSuper ? <EmailSection /> : <SuperAdminNotice what={GATED_COPY.email} />;
  }
}
