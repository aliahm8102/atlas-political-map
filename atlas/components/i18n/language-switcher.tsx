"use client";
import { Languages } from "lucide-react";
import { useI18n } from "./provider";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <button type="button" className="language-switcher" data-testid="language-switcher" onClick={() => setLocale(locale === "fa" ? "en" : "fa")} aria-label={t(locale === "en" ? "Switch to Persian" : "Switch to English")} title={t("Language")}><Languages size={17} /><span lang={locale === "en" ? "fa" : "en"} dir={locale === "en" ? "rtl" : "ltr"}>{locale === "en" ? "فارسی" : "English"}</span></button>;
}
