import PublicHome from "@/components/atlas/public-home";
import { landingMetadata } from "@/lib/seo";
export const metadata = landingMetadata("fa");
export default function Home() {
  return <PublicHome locale="fa" />;
}
