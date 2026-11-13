"use client";

import { MapPin } from "lucide-react";
import { countryProfile } from "@/lib/country-profiles";
import type { Country } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";

export default function CountryProfile({ country, count, year }: { country: Country; count: number; year: number }) {
  const { t, locale, n, text } = useI18n();
  const profile = countryProfile(country, year);
  const name = locale === "fa" ? profile.nameFa : profile.nameEn;
  return <section className="country-profile" aria-label={t("{name} country profile", { name })} data-country-profile={country.code} data-country-year={year} data-country-data-year={profile.dataYear ?? ""}>
    <div className="country-heading"><span className="eyebrow">{t("COUNTRY SPOTLIGHT")}</span>
      <div className="country-profile-identity">{profile.flagPath && <span className="country-flag-portrait"><img key={profile.flagPath} src={profile.flagPath} alt={t("Flag of {name}", { name })} width={80} height={54} /></span>}<div><h2 lang={locale}>{name}</h2></div></div>
      <span className="country-region"><MapPin size={12} />{text(country.region)}<span>·</span>{n(count)}{" " + t("records in") + " "}{n(year, { useGrouping: false })}</span>
    </div>
    <dl className="country-facts">
      <div><dt>{t("Capital")}</dt><dd dir="auto">{(locale === "fa" ? profile.capitalFa : profile.capitalEn) ?? t("Not available")}</dd></div>
      <div><dt>{t("Area (km²)")}</dt><dd>{profile.areaKm2 === null ? t("Not available") : n(profile.areaKm2, { maximumFractionDigits: 2 })}</dd></div>
      <div><dt>{t("Population")}</dt><dd>{profile.population === null ? t("Not available") : n(profile.population)}</dd></div>
    </dl>
    <p className="country-reference-note" role="status">{profile.dataYear === null ? t("No country information recorded for {year}.", { year: n(year, { useGrouping: false }) }) : t("Country information for {year}.", { year: n(year, { useGrouping: false }) })}</p>
  </section>;
}
