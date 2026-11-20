import type { MetadataRoute } from "next";
import { SITE_URL, publicLanguages } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/en"].map(path => ({ url: `${SITE_URL}${path}`, alternates: { languages: publicLanguages } }));
}
