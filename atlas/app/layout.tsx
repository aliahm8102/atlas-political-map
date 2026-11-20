import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n";
import { LanguageProvider } from "@/components/i18n/provider";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { SITE_URL, landingContent, PUBLIC_LOCALE_HEADER } from "@/lib/seo";
import { headers } from "next/headers";

export const viewport: Viewport = { themeColor: "#e9eeeb" };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { t } = createTranslator(locale);
  return {
  metadataBase: new URL(SITE_URL),
  title: t("Atlas Peyma"),
  description: landingContent[locale].description,
  robots: { index: false, follow: false },
  applicationName: t("Atlas Peyma"),
  appleWebApp: { capable: true, title: t("Atlas Peyma"), statusBarStyle: "default" },
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
  const publicPage = (await headers()).has(PUBLIC_LOCALE_HEADER);
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body className="antialiased"><LanguageProvider initialLocale={locale} preserveDocumentTitle={publicPage}><ServiceWorkerRegistration />{children}</LanguageProvider></body>
    </html>
  );
}
