"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X, MapPin, UserRound, ArrowUpRight, Tags, Folder } from "lucide-react";
import { searchPreviews, type SearchDocument, type SearchPreview } from "@/lib/search";
import type { BrowserPeople } from "@/lib/browser-people";
import { useI18n } from "@/components/i18n/provider";
const noOrganization = { tags: {}, groups: [] };

export default function SearchBox({ index, query, organization = noOrganization, onOrganization, onQuery, onSubmit, onSelect }: { organization?: Pick<BrowserPeople, "tags" | "groups">; onOrganization?: (type: "tag" | "group", value: string) => void; index: SearchDocument[]; query: string; onQuery: (query: string) => void; onSubmit: () => void; onSelect: (document: SearchDocument) => void }) {
  const { t, locale, countryName, personTitle, n } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const deferred = useDeferredValue(query);
  const sections = useMemo(() => searchPreviews(index, deferred, organization, locale), [index, deferred, organization, locale]);
  const suggestions = deferred === query ? sections.flatMap(section => section.items) : [];
  const id = useId();
  const expanded = open && Boolean(query.trim());
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, expanded, id]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); input.current?.select(); } };
    const outside = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); } };
    window.addEventListener("keydown", shortcut);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", shortcut); document.removeEventListener("pointerdown", outside); };
  }, []);
  function submit() { setOpen(false); setActive(-1); onSubmit(); input.current?.blur(); }
  function select(item: SearchPreview) { setOpen(false); setActive(-1); if (item.document) onSelect(item.document); else if ((item.type === "tag" || item.type === "group") && item.value) onOrganization?.(item.type, item.value); input.current?.blur(); }
  return <form ref={root} className="topbar-search global-search" data-tour="search" role="search" onSubmit={event => { event.preventDefault(); submit(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
    <Search size={21} aria-hidden="true" />
    <input ref={input} type="search" role="combobox" autoComplete="off" dir="auto" value={query} maxLength={160} aria-label={t("Search people or places")} placeholder={t("Search names, countries or roles…")} aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? id : undefined} aria-activedescendant={expanded && active >= 0 && active < suggestions.length ? `${id}-${active}` : undefined}
      onFocus={() => setOpen(true)} onInput={() => setOpen(true)} onChange={event => { onQuery(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(previous => suggestions.length ? previous < 0 ? (event.key === "ArrowDown" ? 0 : suggestions.length - 1) : (previous + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length : -1); }
        if (event.key === "Enter" && expanded && active >= 0 && suggestions[active]) { event.preventDefault(); select(suggestions[active]); }
      }} />
    {query && <button type="button" className="icon-plain" aria-label={t("Clear search")} onClick={() => { onQuery(""); setActive(-1); input.current?.focus(); }}><X size={17} /></button>}
    <button type="submit" className="search-submit" aria-label={t("Show search results")}><Search size={17} /><span>{t("Search")}</span></button>
    {expanded && <div className="search-results search-autocomplete">
      <div className="search-suggestion-heading">{t("Suggestions")}<span>{t("{count} results", { count: n(sections.reduce((total, section) => total + section.total, 0)) })}</span></div>
      <div id={id} role="listbox" aria-label={t("Search suggestions")}>
        {deferred === query && sections.map(section => <div role="group" aria-label={t(section.type === "person" ? "People" : section.type === "place" ? "Countries" : section.type === "tag" ? "Tags" : "Groups")} key={section.type} data-preview-type={section.type}>
          <div className="search-preview-heading">{t(section.type === "person" ? "People" : section.type === "place" ? "Countries" : section.type === "tag" ? "Tags" : "Groups")}<span>{n(section.total)}</span></div>
          {section.items.map(item => { const index = suggestions.findIndex(suggestion => suggestion.id === item.id); return <a href={item.href} role="option" tabIndex={-1} aria-selected={active === index} id={`${id}-${index}`} key={item.id} onMouseDown={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) event.preventDefault(); }} onMouseEnter={() => setActive(index)} onClick={event => { if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); select(item); }}>
            {item.type === "place" ? <MapPin size={18} /> : item.type === "tag" ? <Tags size={18} /> : item.type === "group" ? <Folder size={18} /> : <UserRound size={18} />}<span><strong>{locale === "fa" ? item.faName : item.name}</strong><small>{item.document?.person ? `${personTitle(item.document.person)} · ${countryName(item.document.person.country)}` : item.type === "place" ? t("Country") : t(item.count === 1 ? "{count} person" : "{count} people", { count: item.count ?? 0 })}</small></span><ArrowUpRight size={15} />
          </a>; })}
        </div>)}
      </div>
      {!suggestions.length && <p className="search-suggestion-empty">{t("No suggestions yet. View results for alternatives.")}</p>}
      <button type="button" className="search-all-results" onMouseDown={event => event.preventDefault()} onClick={submit}>{t("View all results")}<ArrowUpRight size={16} /></button>
    </div>}
  </form>;
}
