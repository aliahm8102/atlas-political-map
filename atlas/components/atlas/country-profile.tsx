"use client";

import { MapPin } from "lucide-react";
import { countryProfile } from "@/lib/country-profiles";
import type { Country } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import { countryEntities, countryExistsAt, mapDate } from "@/lib/country-entities";

export default function CountryProfile({ country, count, year, month = 0 }: { country: Country; count: number; year: number; month?: number }) {
  const { t, locale, n, text, date } = useI18n();
  const profile = countryProfile(country, year, month);
  const entity = countryEntities[country.code];
  const exists = countryExistsAt(country.code, mapDate(year, month));
  const name = locale === "fa" ? profile.nameFa : profile.nameEn;
  return <section className="country-profile" aria-label={t("{name} country profile", { name })} data-country-profile={country.code} data-country-year={year} data-country-data-year={profile.dataYear ?? ""}>
    <div className="country-heading"><span className="eyebrow">{t("COUNTRY SPOTLIGHT")}</span>
      <div className="country-profile-identity">{profile.flagPath && <span className="country-flag-portrait"><img key={profile.flagPath} src={profile.flagPath} alt={t("Flag of {name}", { name })} width={80} height={54} /></span>}<div><h2 lang={locale}>{name}</h2></div></div>
      <span className="country-region"><MapPin size={12} />{text(country.region)}<span>·</span>{n(count)}{" " + t("records in") + " "}{n(year, { useGrouping: false })}</span>
    </div>
    {(entity?.foundedOn || entity?.dissolvedOn || !exists) && <div className="country-lifetime">
      {entity?.foundedOn && <p>{t("Identity begins")}: {date(entity.foundedOn, { year: "numeric", month: "short", day: "numeric" })}</p>}
      {entity?.dissolvedOn && <p>{t("Identity ends")}: {date(entity.dissolvedOn, { year: "numeric", month: "short", day: "numeric" })}</p>}
      {!exists && <p role="status">{t("This country identity is not active at the selected date.")}</p>}
    </div>}
    <dl className="country-facts">
      <div><dt>{t("Capital")}</dt><dd dir="auto">{(locale === "fa" ? profile.capitalFa : profile.capitalEn) ?? t("Not available")}</dd></div>
      <div><dt>{t("Area (km²)")}</dt><dd>{profile.areaKm2 === null ? t("Not available") : n(profile.areaKm2, { maximumFractionDigits: 2 })}</dd></div>
      <div><dt>{t("Population")}</dt><dd>{profile.population === null ? t("Not available") : n(profile.population)}</dd></div>
    </dl>
    <p className="country-reference-note" role="status">{profile.dataYear === null ? t("No country information recorded for {year}.", { year: n(year, { useGrouping: false }) }) : t("Country information for {year}.", { year: n(year, { useGrouping: false }) })}</p>
  </section>;
}
