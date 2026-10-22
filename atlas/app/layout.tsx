import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n";
import { LanguageProvider } from "@/components/i18n/provider";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

export const viewport: Viewport = { themeColor: "#e9eeeb" };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = createTranslator(await getLocale());
  return {
  title: t("Atlas — A world of perspectives"),
  description: t("Explore an interactive political atlas, travel through its timeline, and make your own perspective."),
  applicationName: "Atlas",
  appleWebApp: { capable: true, title: "Atlas", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body className="antialiased"><LanguageProvider initialLocale={locale}><ServiceWorkerRegistration />{children}</LanguageProvider></body>
    </html>
  );
}
