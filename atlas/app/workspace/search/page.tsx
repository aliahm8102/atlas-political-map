import AuthenticatedWorkspace from "@/components/atlas/authenticated-workspace";
import { parseSearchState } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  return <AuthenticatedWorkspace initialPage="search" initialSearch={parseSearchState(params)} />;
}
