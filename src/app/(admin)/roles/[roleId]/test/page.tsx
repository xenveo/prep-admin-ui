import { Suspense } from "react";
import { PreviewInterview } from "@/features/roles/preview-interview";

// The role editor layout renders this page only once the role has loaded on the client, so it is
// never in the server render that instant-navigation validation checks.
export const instant = false;

export default function Page() {
  return <Suspense fallback={<p aria-busy="true">Loading test interview…</p>}><PreviewInterview /></Suspense>;
}
