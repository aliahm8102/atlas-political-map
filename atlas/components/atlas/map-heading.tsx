"use client";

import { useI18n } from "@/components/i18n/provider";

export default function MapHeading() {
  const { locale } = useI18n();
  return locale === "fa"
    ? <>جهان را <em>بخوان</em>، <em>ببین</em> و <em>بازآفرینی</em> کن</>
    : <><em>Read</em>, <em>see</em> and <em>reimagine</em> the world</>;
}
