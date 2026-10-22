import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Atlas — Interactive Political Map",
    short_name: "Atlas",
    description: "Explore the world and its political history with Atlas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e9eeeb",
    theme_color: "#e9eeeb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
