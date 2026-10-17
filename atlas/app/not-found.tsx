"use client";
import { useI18n } from "@/components/i18n/provider";
import LanguageSwitcher from "@/components/i18n/language-switcher";
import Link from "next/link";
export default function NotFound() { const { t } = useI18n(); return <main className="standalone-error"><LanguageSwitcher /><span className="eyebrow">{t("OFF THE MAP")}</span><h1>{t("This place doesn’t exist.")}</h1><Link className="primary-button" href="/">{t("Return to your atlas")}</Link></main>; }
