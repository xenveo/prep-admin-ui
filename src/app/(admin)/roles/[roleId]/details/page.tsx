import { DetailsScreen } from "@/features/roles/details-screen";

// The role editor layout renders this page only once the role has loaded on the client, so it is
// never in the server render that instant-navigation validation checks.
export const instant = false;

export default function Page() {
  return <DetailsScreen />;
}
