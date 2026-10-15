import { Suspense } from "react";
import { PreviewInterview } from "@/features/roles/preview-interview";

export default function Page() {
  return <Suspense fallback={<p aria-busy="true">Loading test interview…</p>}><PreviewInterview /></Suspense>;
}
