import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n";
import { LanguageProvider } from "@/components/i18n/provider";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = createTranslator(await getLocale());
  return {
  title: t("Atlas — A world of perspectives"),
  description: t("Explore an interactive political atlas, travel through its timeline, and make your own perspective."),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
      <body className="antialiased"><LanguageProvider initialLocale={locale}>{children}</LanguageProvider></body>
    </html>
  );
}
