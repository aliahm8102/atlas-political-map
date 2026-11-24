"use client";

import { useState } from "react";
import { ArrowUpRight, Globe2 } from "lucide-react";
import type { Country } from "@/lib/atlas";
import { countryFocusDate } from "@/lib/country-entities";
import { countryInRange, monthIndex, type DirectoryRange } from "@/lib/directory-filters";
import { timelineMonth, timelineMonthValue, type TimelineBounds } from "@/lib/timeline";
import { countryProfile } from "@/lib/country-profiles";
import { normalizeSearch } from "@/lib/i18n";
import { mapResultHref } from "@/lib/map-links";
import { useI18n } from "@/components/i18n/provider";
import DirectoryExport from "./directory-export";
import { countriesExport } from "@/lib/directory-export";

export default function CountryDirectory({ countries, year, month, region, onLocate, bounds, range = { from: timelineMonthValue(year * 12 + month), to: timelineMonthValue(year * 12 + month) } }: { countries: Country[]; year: number; month: number; region: string; range?: DirectoryRange; bounds?: TimelineBounds; onLocate: (country: Country) => void }) {
  const i18n = useI18n();
  const { t, locale, n, text } = i18n;
  const [query, setQuery] = useState("");
  const { year: fromYear, month: fromMonth } = timelineMonth(monthIndex(range.from));
  const { year: toYear, month: toMonth } = timelineMonth(monthIndex(range.to));
  const singleYear = fromYear === toYear;
  const filtered = countries.filter(country => (region === "All regions" || country.region === region) && countryInRange(country.code, range, bounds))
    .map(country => { const focus = countryFocusDate(country.code, fromYear, fromMonth); return { country, profile: countryProfile(country, fromYear, focus.year === fromYear ? focus.month : fromMonth) }; })
    .filter(({ country, profile }) => normalizeSearch([profile.nameEn, profile.nameFa, ...(singleYear ? [profile.capitalEn, profile.capitalFa] : []), country.name].join(" ")).includes(normalizeSearch(query)))
    .sort((a, b) => (locale === "fa" ? a.profile.nameFa : a.profile.nameEn).localeCompare(locale === "fa" ? b.profile.nameFa : b.profile.nameEn, locale));
  return <section className="country-directory" aria-label={t("Country directory")}>
    <label className="country-directory-search">{t("Search countries or capitals")}<input className="soft-input" type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <p className="field-hint" role="status">{t("{count} countries", { count: filtered.length })}</p>
    <DirectoryExport count={filtered.length} filename={`atlas-countries-${range.from}-${range.to}-${locale}`} table={() => countriesExport(filtered.map(item => item.profile), fromYear, fromMonth, i18n, locale, toYear, toMonth)} />
    {!singleYear && <p className="field-hint">{t("Capital, area, population and flag are shown and exported only for a single calendar year.")}</p>}
    <div className="people-grid">{filtered.map(({ country, profile }) => {
      const name = locale === "fa" ? profile.nameFa : profile.nameEn;
      return <article className="person-card country-card" key={country.code} data-country-code={country.code}>
        <div className="country-card-identity">{singleYear && profile.flagPath ? <img src={profile.flagPath} alt={t("Flag of {name}", { name })} width={64} height={44} /> : <Globe2 size={34} aria-hidden="true" />}<div><h3>{name}</h3><p>{text(country.region)}</p></div></div>
        {singleYear && <dl className="country-facts">
          <div><dt>{t("Capital")}</dt><dd>{(locale === "fa" ? profile.capitalFa : profile.capitalEn) ?? t("Not available")}</dd></div>
          <div><dt>{t("Area (km²)")}</dt><dd>{profile.areaKm2 === null ? t("Not available") : n(profile.areaKm2, { maximumFractionDigits: 2 })}</dd></div>
          <div><dt>{t("Population")}</dt><dd>{profile.population === null ? t("Not available") : n(profile.population)}</dd></div>
        </dl>}
        <a className="text-link" href={mapResultHref({ country })} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onLocate(country); }}>{t("View on map")}<ArrowUpRight size={16} /></a>
      </article>;
    })}</div>
    {!filtered.length && <div className="empty-state"><h2>{t("No countries in this view.")}</h2><p>{t("Try a different date, search, or region.")}</p></div>}
  </section>;
}
