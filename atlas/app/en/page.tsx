import PublicHome from "@/components/atlas/public-home";
import { landingMetadata } from "@/lib/seo";

export const metadata = landingMetadata("en");
export default function EnglishHome() { return <PublicHome locale="en" />; }
