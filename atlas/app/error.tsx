"use client";
import { useI18n } from "@/components/i18n/provider";
import LanguageSwitcher from "@/components/i18n/language-switcher";
export default function Error({ reset }: { reset: () => void }) { const { t } = useI18n(); return <main className="standalone-error"><LanguageSwitcher /><h1>{t("We couldn’t open your atlas.")}</h1><p>{t("Please try again. If you just connected Supabase, check that both database migrations have been applied.")}</p><button className="primary-button" onClick={reset}>{t("Try again")}</button><a href="/login">{t("Return to sign-in")}</a></main>; }
