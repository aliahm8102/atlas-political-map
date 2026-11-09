"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Bookmark, FolderPlus, MapPin, Pencil, Tags, Trash2 } from "lucide-react";
import { roleLabels, type Person } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import type { useBrowserPeople } from "./use-browser-people";
import Modal from "./modal";
import Portrait from "./portrait";
import { normalizeSearch } from "@/lib/i18n";

type Props = { people: Person[]; browser: ReturnType<typeof useBrowserPeople>; bookmarks: string[]; onBookmark: (id: string) => void; onLocate: (person: Person) => void; onEdit?: (id: string) => void; children?: ReactNode };
export default function PeopleDirectory({ people, browser, bookmarks, onBookmark, onLocate, onEdit, children }: Props) {
  const { t, personName, personTitle, countryName, n } = useI18n();
  const [groupFilter, setGroupFilter] = useState("");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [organizing, setOrganizing] = useState<Person | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [groupName, setGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tags = [...new Set(Object.values(browser.tags).flat())].sort();
  const selectedGroup = browser.groups.find(group => group.id === groupFilter);
  const filtered = people.filter(person => (!selectedGroup || selectedGroup.personIds.includes(person.id)) && (!tagFilter || browser.tags[person.id]?.includes(tagFilter)) && normalizeSearch([person.name, person.nameFa, person.title, person.titleFa, personName(person), personTitle(person), countryName(person.country), ...(browser.tags[person.id] ?? []), ...browser.groups.filter(group => group.personIds.includes(person.id)).map(group => group.name)].join(" ")).includes(normalizeSearch(query)));
  return <section className="directory">
    {children}
    <div className="directory-organization">
      <p className="field-hint">{t("Tags and groups are private and saved in this browser for your account.")}</p>
      <label>{t("Search people, tags or groups")}<input className="soft-input" type="search" aria-label={t("Search people, tags or groups")} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="directory-filters">
        <label>{t("Group")}<select className="soft-input" aria-label={t("Filter by group")} value={selectedGroup ? groupFilter : ""} onChange={event => setGroupFilter(event.target.value)}><option value="">{t("All groups")}</option>{browser.groups.map(group => <option key={group.id} value={group.id}>{group.name} ({n(group.personIds.length)})</option>)}</select></label>
        <label>{t("Tags")}<select className="soft-input" aria-label={t("Filter by tag")} value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">{t("All tags")}</option>{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        {selectedGroup && <><button type="button" className="text-link" onClick={() => { setEditingGroup(selectedGroup.id); setGroupName(selectedGroup.name); }}>{t("Rename group")}<Pencil size={14} /></button><button type="button" className="text-link" onClick={() => { if (browser.removeGroup(selectedGroup.id)) { setGroupFilter(""); if (editingGroup === selectedGroup.id) { setEditingGroup(null); setGroupName(""); } } }}>{t("Delete group")}<Trash2 size={14} /></button></>}
      </div>
      <form className="group-form" onSubmit={event => {
        event.preventDefault(); setError("");
        const name = groupName.trim();
        if (!name) return;
        if (browser.groups.some(group => group.id !== editingGroup && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { setError(t("A group with this name already exists.")); return; }
        const existing = browser.groups.find(group => group.id === editingGroup);
        if (browser.saveGroup({ id: existing?.id ?? crypto.randomUUID(), name, personIds: existing?.personIds ?? [] })) { setGroupName(""); setEditingGroup(null); }
      }}><label className="sr-only" htmlFor="directory-group-name">{t("Group name")}</label><input id="directory-group-name" className="soft-input" dir="auto" maxLength={60} required placeholder={t("Group name")} value={groupName} onChange={event => setGroupName(event.target.value)} /><button type="submit" className="secondary-button" disabled={!browser.ready || (!editingGroup && browser.groups.length >= 100)}><FolderPlus size={15} />{editingGroup ? t("Save group") : t("Create group")}</button>{editingGroup && <button type="button" className="text-link" onClick={() => { setEditingGroup(null); setGroupName(""); }}>{t("Cancel")}</button>}</form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <p className="field-hint" role="status">{t(filtered.length === 1 ? "{count} person" : "{count} people", { count: filtered.length })}</p>
    {filtered.length ? <div className="people-grid">{filtered.map(person => <article className="person-card" key={person.id} data-person-id={person.id}>
      <div className="person-card-top"><Portrait person={person} /><button className={`icon-button ${bookmarks.includes(person.id) ? "is-bookmarked" : ""}`} aria-label={t(bookmarks.includes(person.id) ? "Remove bookmark for {name}" : "Bookmark {name}", { name: personName(person) })} onClick={() => onBookmark(person.id)}><Bookmark size={16} fill={bookmarks.includes(person.id) ? "currentColor" : "none"} /></button></div>
      <span className={`role-pill ${person.role}`}>{t(roleLabels[person.role])}</span><h3>{personName(person)}</h3><p>{personTitle(person)}</p>
      <div className="person-tags">{(browser.tags[person.id] ?? []).map(tag => <span key={tag} className="person-tag" dir="auto">{tag}</span>)}{browser.groups.filter(group => group.personIds.includes(person.id)).map(group => <span className="person-tag person-group" key={group.id} dir="auto">{group.name}</span>)}</div>
      <div className="person-organization-actions"><button className="text-link" disabled={!browser.ready} aria-label={t("Organize {name}", { name: personName(person) })} onClick={() => { setOrganizing(person); setTagDraft((browser.tags[person.id] ?? []).join(", ")); setError(""); }}><Tags size={14} />{t("Tags and groups")}</button>{onEdit && browser.people.some(item => item.id === person.id) && <button className="text-link" onClick={() => onEdit(person.id)} aria-label={t("Edit {name}", { name: personName(person) })}><Pencil size={14} />{t("Edit character")}</button>}</div>
      <div className="person-card-bottom"><span><MapPin size={12} />{countryName(person.country)}</span><button className="text-link" onClick={() => onLocate(person)} aria-label={t("View {name} on the map", { name: personName(person) })}><ArrowUpRight size={16} /></button></div>
    </article>)}</div> : <div className="empty-state"><h2>{t("No figures in this view.")}</h2><p>{t("Try a different date, search, or region.")}</p>{(groupFilter || tagFilter || query) && <button className="secondary-button" onClick={() => { setGroupFilter(""); setTagFilter(""); setQuery(""); }}>{t("Clear filters")}</button>}</div>}
    {organizing && <Modal title={t("Organize {name}", { name: personName(organizing) })} onClose={() => setOrganizing(null)}>
      <form className="character-form" onSubmit={event => { event.preventDefault(); const values = [...new Set(tagDraft.split(/[,،\n]/).map(value => value.trim()).filter(Boolean))]; if (values.length > 20 || values.some(tag => tag.length > 40)) { setError(t("Use up to 20 tags, each no longer than 40 characters.")); return; } if (browser.setTags(organizing.id, values)) setOrganizing(null); }}>
        <label>{t("Tags")}<input className="soft-input" name="person-tags" dir="auto" value={tagDraft} onChange={event => setTagDraft(event.target.value)} /></label><p className="field-hint">{t("Separate tags with commas. Edit or remove them here.")}</p>
        <fieldset className="group-memberships"><legend>{t("Groups")}</legend>{browser.groups.map(group => <label key={group.id}><input type="checkbox" checked={group.personIds.includes(organizing.id)} onChange={event => browser.setMembership(organizing.id, group.id, event.target.checked)} /><span dir="auto">{group.name}</span></label>)}{!browser.groups.length && <p className="field-hint">{t("Create a group in the directory first.")}</p>}</fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={!browser.ready}>{t("Save tags")}</button>
      </form>
    </Modal>}
  </section>;
}
