"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, ArrowUpRight, RotateCcw } from "lucide-react";
import { alternativeQueries, defaultSearchState, searchAtlas, searchUrl, type SearchDocument, type SearchState } from "@/lib/search";
import { regions, roleLabels } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import Portrait from "./portrait";
import { getTimelineRange, TIMELINE_START_YEAR } from "@/lib/timeline";

export default function SearchResults({ index, state, onChange, onSelect }: { index: SearchDocument[]; state: SearchState; onChange: (state: SearchState) => void; onSelect: (document: SearchDocument) => void }) {
  const { t, locale, n, text, countryName, personName, personTitle, periodLabel } = useI18n();
  const [pagination, setPagination] = useState({ signature: "", limit: 24 });
  const signature = searchUrl(state);
  const { endYear } = getTimelineRange();
  const limit = pagination.signature === signature ? pagination.limit : 24;
  const hits = useMemo(() => searchAtlas(index, state, locale), [index, state, locale]);
  const unfiltered = useMemo(() => searchAtlas(index, { ...defaultSearchState, query: state.query }, locale), [index, state.query, locale]);
  const alternatives = useMemo(() => hits.length ? [] : alternativeQueries(index, state.query, locale), [index, state.query, locale, hits.length]);
  const filtered = Boolean(state.region || state.role || state.year || state.type !== "all");
  const patch = (patch: Partial<SearchState>) => onChange({ ...state, ...patch });
  const reset = () => onChange({ ...defaultSearchState, query: state.query });
  return <section className="atlas-search-results" aria-label={t("Search results")}>
    <div className="search-summary"><div><span className="eyebrow">{t("SEARCH THE ATLAS")}</span><h1 id="atlas-search-heading" tabIndex={-1}>{state.query ? t("Results for “{query}”", { query: state.query }) : t("Explore people and places")}</h1><p role="status">{t("{count} results", { count: n(hits.length) })}{hits.some(hit => hit.approximate) && <span> · {t("Similar spellings included")}</span>}</p></div>{filtered && <button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />{t("Reset search filters")}</button>}</div>
    <div className="search-filters">
      <label>{t("Result type")}<select value={state.type} onChange={event => patch({ type: event.target.value as SearchState["type"], ...(event.target.value === "place" ? { role: "", year: "" } : {}) })}><option value="all">{t("People and places")}</option><option value="person">{t("People")}</option><option value="place">{t("Places")}</option></select></label>
      <label>{t("Region")}<select value={state.region} onChange={event => patch({ region: event.target.value })}><option value="">{t("All regions")}</option>{regions.slice(1).map(region => <option key={region} value={region}>{text(region)}</option>)}</select></label>
      <label>{t("Role")}<select disabled={state.type === "place"} value={state.role} onChange={event => patch({ role: event.target.value, ...(event.target.value ? { type: "person" } : {}) })}><option value="">{t("All roles")}</option>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{t(label)}</option>)}</select></label>
      <label>{t("Active in year")}<select value={state.year} disabled={state.type === "place"} onChange={event => patch({ year: event.target.value, ...(event.target.value ? { type: "person" } : {}) })}><option value="">{t("Any year")}</option>{Array.from({ length: endYear - TIMELINE_START_YEAR + 1 }, (_, index) => endYear - index).map(year => <option key={year} value={year}>{n(year, { useGrouping: false })}</option>)}</select></label>
      <label>{t("Sort results")}<select value={state.sort} onChange={event => patch({ sort: event.target.value as SearchState["sort"] })}><option value="relevance">{t("Most relevant")}</option><option value="name">{t("Name A–Z")}</option><option value="newest">{t("Most recent term")}</option></select></label>
    </div>
    <p className="search-scope-note">{t("Search includes all recorded dates and your own characters. Places are countries in this atlas.")}</p>
    {hits.length ? <><div className="search-result-grid">{hits.slice(0, limit).map(({ document, approximate }) => <article className="search-result-card" key={document.id} data-search-result={document.id}>
      <div className="search-result-identity">{document.person ? <Portrait person={document.person} /> : <span className="search-place-icon"><MapPin size={24} /></span>}<div><span className="search-type-badge">{document.type === "person" ? t("Person") : t("Country")}{approximate ? ` · ${t("Similar spelling")}` : ""}</span><h3>{locale === "fa" ? document.faName : document.name}</h3></div></div>
      <p>{document.person ? personTitle(document.person.title) : text(document.region)}</p>{document.person && <small>{countryName(document.person.country)} · {periodLabel(document.person)}</small>}
      <button type="button" className="text-link" onClick={() => onSelect(document)}>{t("View on map")}<ArrowUpRight size={16} /></button>
    </article>)}</div>{hits.length > limit && <button className="secondary-button search-load-more" type="button" onClick={() => setPagination({ signature, limit: limit + 24 })}>{t("Show more results")}</button>}</> : <div className="search-empty-state"><Search size={34} /><h3>{t("No results found")}</h3><p>{t("Try another spelling, a shorter phrase, or remove a filter.")}</p>
      {filtered && unfiltered.length > 0 && <button type="button" className="primary-button" onClick={reset}>{t("Show {count} results without filters", { count: n(unfiltered.length) })}</button>}
      {alternatives.length > 0 && <div className="search-alternatives"><strong>{t("Try these instead")}</strong>{[...new Set(alternatives)].map(query => <button type="button" key={query} onClick={() => onChange({ ...defaultSearchState, query })}>{query}</button>)}</div>}
      <div className="search-examples"><span>{t("Try a search")}</span>{["Iran", "Barack Obama", "military"].map(query => <button type="button" key={query} onClick={() => onChange({ ...defaultSearchState, query })}>{query === "Iran" ? countryName(query) : query === "military" ? t("Military") : personName(query)}</button>)}</div>
    </div>}
  </section>;
}
