"use client";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { createTranslator, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

type LanguageContext = ReturnType<typeof createTranslator> & { locale: Locale; setLocale: (locale: Locale) => void };
const Context = createContext<LanguageContext | null>(null);

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    if (next !== "en" && next !== "fa") return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    updateLocale(next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    document.title = createTranslator(locale).t("Atlas — A world of perspectives");
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, ...createTranslator(locale) }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const context = useContext(Context);
  if (!context) throw new Error("LanguageProvider is required.");
  return context;
}
