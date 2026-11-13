"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, HardDrive, ImagePlus, MapPin, Pencil, Send, Trash2, UserPlus, X } from "lucide-react";
import { type Country, type Person, type Role, roleLabels } from "@/lib/atlas";
import { customPersonSchema, type CustomPerson } from "@/lib/browser-people";
import { useI18n } from "@/components/i18n/provider";
import Portrait from "./portrait";
import { getTimelineRange, TIMELINE_START_YEAR } from "@/lib/timeline";
import type { ActionResult, Publication } from "@/lib/administration";
import { characterDateFields, characterDateValue } from "@/lib/character-dates";

type Props = { initialPerson?: CustomPerson; countries: Country[]; people: CustomPerson[]; ready: boolean; onAdd: (person: CustomPerson) => boolean; onUpdate: (person: CustomPerson) => boolean; onRemove: (id: string) => boolean; onLocate: (person: Person) => void; publications?: Publication[]; publicationAvailable?: boolean; onPublish?: (person: CustomPerson) => Promise<ActionResult<Publication>> };
export default function CharactersPage({ initialPerson, countries, people, ready, onAdd, onUpdate, onRemove, onLocate, publications = [], publicationAvailable = false, onPublish }: Props) {
  const { t, n, date, countryName, text, personName, personTitle } = useI18n();
  const portraitInput = useRef<HTMLInputElement>(null);
  const portraitHintId = useId();
  const [editingId, setEditingId] = useState<string | null>(initialPerson?.id ?? null);
  const [name, setName] = useState(initialPerson?.name ?? "");
  const [title, setTitle] = useState(initialPerson?.title ?? "");
  const [nameFa, setNameFa] = useState(initialPerson?.nameFa ?? "");
  const [titleFa, setTitleFa] = useState(initialPerson?.titleFa ?? "");
  const [role, setRole] = useState<Role>(initialPerson?.role ?? "leader");
  const [countryCode, setCountryCode] = useState(initialPerson?.countryCode ?? countries.find(country => country.code === "364")?.code ?? countries[0]?.code ?? "");
  const country = countries.find(country => country.code === countryCode);
  const [lat, setLat] = useState(String(initialPerson?.lat ?? country?.lat ?? 0));
  const [lng, setLng] = useState(String(initialPerson?.lng ?? country?.lng ?? 0));
  const [start, setStart] = useState(characterDateFields(initialPerson?.startYear).year);
  const [startMonth, setStartMonth] = useState(characterDateFields(initialPerson?.startYear).month);
  const [end, setEnd] = useState(characterDateFields(initialPerson?.endYear).year);
  const [endMonth, setEndMonth] = useState(characterDateFields(initialPerson?.endYear).month);
  const [imageUrl, setImageUrl] = useState(initialPerson?.imageUrl ?? "");
  const [portraitName, setPortraitName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publicationError, setPublicationError] = useState("");
  function resetEditor() {
    setEditingId(null); setName(""); setTitle(""); setNameFa(""); setTitleFa(""); setImageUrl(""); setPortraitName(""); setStart(""); setEnd(""); setStartMonth(0); setEndMonth(0); setError(""); setMessage("");
    if (portraitInput.current) portraitInput.current.value = "";
  }
  function edit(person: CustomPerson) {
    setEditingId(person.id); setName(person.name); setTitle(person.title); setNameFa(person.nameFa ?? ""); setTitleFa(person.titleFa ?? "");
    setRole(person.role); setCountryCode(person.countryCode); setLat(String(person.lat)); setLng(String(person.lng));
    setStart(characterDateFields(person.startYear).year); setStartMonth(characterDateFields(person.startYear).month);
    setEnd(characterDateFields(person.endYear).year); setEndMonth(characterDateFields(person.endYear).month);
    setImageUrl(person.imageUrl); setPortraitName(""); if (portraitInput.current) portraitInput.current.value = ""; setError(""); setMessage("");
    document.querySelector<HTMLInputElement>('[name="character-name"]')?.focus();
  }
  async function publish(person: CustomPerson) {
    if (!onPublish || !publicationAvailable || publishing) return;
    setPublishing(person.id); setPublicationError("");
    try { const result = await onPublish(person); if (!result.ok) setPublicationError(t(result.error)); }
    catch { setPublicationError(t("The request could not be saved. Refresh and try again.")); }
    finally { setPublishing(null); }
  }
  async function portrait(file?: File) {
    if (!file) return;
    setError(""); setProcessing(true);
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error();
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext("2d"); if (!context) throw new Error();
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        setImageUrl(canvas.toDataURL("image/webp", .8));
        setPortraitName(file.name);
      } finally { bitmap.close(); }
    } catch { setError(t("Choose a PNG, JPEG or WebP image smaller than 5 MB.")); }
    finally { setProcessing(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!country || !ready || processing) return;
    if (![name, title, nameFa, titleFa].every(value => value.trim())) { setError(t("Enter the name and description in both English and Persian.")); return; }
    if (editingId && publications.some(item => item.localId === editingId.slice(7) && item.status === "approved")) { resetEditor(); return; }
    const result = customPersonSchema.safeParse({ id: editingId ?? `custom:${crypto.randomUUID()}`, name, title, nameFa, titleFa, role, lat: Number(lat), lng: Number(lng), countryCode, country: country.name, region: country.region, imageUrl, startYear: characterDateValue(start, startMonth), endYear: characterDateValue(end, endMonth), dataset: "custom" });
    if (!result.success) { setError(t("Check the coordinates and dates. The end date must follow the start date.")); return; }
    if (!(editingId ? onUpdate(result.data) : onAdd(result.data))) { setError(t("Browser storage is full or unavailable. Your change was not saved.")); return; }
    resetEditor();
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]'); if (input) input.value = "";
    setMessage(t("Character saved in this browser."));
  }
  const dateTerms = [
    { key: "start", label: "Start date (optional)", monthLabel: "Start month", year: start, month: startMonth, setYear: setStart, setMonth: setStartMonth },
    { key: "end", label: "End date (optional)", monthLabel: "End month", year: end, month: endMonth, setYear: setEnd, setMonth: setEndMonth },
  ] as const;
  return <div className="characters-layout">
    <section className="settings-card character-editor">
      <div className="settings-card-heading"><span className="large-icon"><UserPlus size={23} /></span><div><h2>{editingId ? t("Edit character") : t("Add character")}</h2><p>{t("Create a person for your own map.")}</p></div></div>
      <p className="browser-storage-note"><HardDrive size={17} /><span>{t("Characters and marker positions are saved only in this browser for your account. Clearing browser data removes them.")}</span></p>
      <form onSubmit={submit} className="character-form">
        <div className="character-fields"><label>{t("Character name (English)")}<input className="soft-input" dir="ltr" lang="en" name="character-name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
          <label>{t("Character name (Persian)")}<input className="soft-input" dir="rtl" lang="fa" name="character-name-fa" required maxLength={120} value={nameFa} onChange={event => setNameFa(event.target.value)} /></label></div>
        <div className="character-fields"><label>{t("Office or description (English)")}<input className="soft-input" dir="ltr" lang="en" name="character-title" required maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label>{t("Office or description (Persian)")}<input className="soft-input" dir="rtl" lang="fa" name="character-title-fa" required maxLength={240} value={titleFa} onChange={event => setTitleFa(event.target.value)} /></label></div>
        {editingId && publications.some(item => item.localId === editingId.slice(7) && item.status === "pending") && <p className="field-hint">{t("Edits stay in this browser. The pending review keeps the submitted version.")}</p>}
        <div className="character-fields"><label>{t("Role")}<select className="soft-input" name="character-role" value={role} onChange={event => setRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label>{t("Country")}<select className="soft-input" name="character-country" value={countryCode} onChange={event => { const selected = countries.find(country => country.code === event.target.value); setCountryCode(event.target.value); if (selected) { setLat(String(selected.lat)); setLng(String(selected.lng)); } }}>{[...countries].sort((a, b) => countryName(a.name).localeCompare(countryName(b.name))).map(country => <option key={country.code} value={country.code}>{countryName(country.name)}</option>)}</select></label></div>
        <div className="character-fields"><label>{t("Latitude")}<input className="soft-input" dir="ltr" name="character-latitude" type="number" step="any" min={-90} max={90} required value={lat} onChange={event => setLat(event.target.value)} /></label><label>{t("Longitude")}<input className="soft-input" dir="ltr" name="character-longitude" type="number" step="any" min={-180} max={180} required value={lng} onChange={event => setLng(event.target.value)} /></label></div>
        <p className="field-hint">{t("Country coordinates are filled automatically. You can also drag the portrait on the map.")}</p>
        <div className="character-fields">{dateTerms.map(term => <fieldset key={term.key} className="character-term"><legend>{t(term.label)}</legend><div className="character-term-fields">
          <label>{t("Year")}<input className="soft-input" dir="ltr" aria-label={t(term.key === "start" ? "Start year (optional)" : "End year (optional)")} name={`character-${term.key}`} type="number" step={1} min={TIMELINE_START_YEAR} max={getTimelineRange().endYear} value={term.year} onChange={event => term.setYear(event.target.value)} /></label>
          <label>{t("Month")}<select className="soft-input" name={`character-${term.key}-month`} aria-label={t(term.monthLabel)} value={term.month} disabled={!term.year} onChange={event => term.setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{date(new Date(Date.UTC(2000, month, 1)), { month: "long" })}</option>)}</select></label>
        </div></fieldset>)}</div>
        <p className="field-hint">{t("Leave dates empty to show this person throughout the timeline. The end month is excluded.")}</p>
        <fieldset className="portrait-picker"><legend>{t("Portrait (optional)")}</legend><div className="portrait-picker-row">
          <input ref={portraitInput} name="character-portrait" type="file" accept="image/png,image/jpeg,image/webp" disabled={processing} hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void portrait(file); }} />
          <button type="button" className="secondary-button portrait-select" aria-describedby={portraitHintId} disabled={processing} onClick={() => portraitInput.current?.click()}><ImagePlus size={18} />{t(processing ? "Preparing portrait…" : imageUrl ? "Replace portrait" : "Choose portrait")}</button>
          <span className="portrait-file-name" dir="auto" aria-live="polite">{portraitName || t(imageUrl ? "Portrait ready" : "No portrait selected")}</span>
        </div><p id={portraitHintId} className="field-hint">{t("Choose a PNG, JPEG or WebP image smaller than 5 MB.")}</p></fieldset>
        {imageUrl && <div className="character-portrait-preview"><Portrait key={imageUrl} person={{ name: name || "?", imageUrl, role } as Person} /><button type="button" className="text-link" onClick={() => { setImageUrl(""); setPortraitName(""); if (portraitInput.current) portraitInput.current.value = ""; }}><X size={14} />{t("Remove portrait")}</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={!ready || processing || (!editingId && people.length >= 200)}>{processing ? t("Preparing portrait…") : t("Save character")}<Check size={16} /></button>
        {editingId && <button className="secondary-button" type="button" disabled={processing} onClick={resetEditor}>{t("Cancel")}</button>}
        {people.length >= 200 && <p className="field-hint">{t("You can store up to 200 characters in this browser.")}</p>}
      </form>
    </section>
    <section className="settings-card character-collection"><div className="section-heading"><h2>{t("My characters")}</h2><span className="mini-count">{n(people.length)}</span></div>
      <p className="field-hint">{t("Send a character for review. It appears on the shared map only after administrator approval.")}</p>
      {!publicationAvailable && <p className="field-hint">{t(onPublish ? "Administration is not enabled yet." : "Sign in with an online account to publish characters.")}</p>}
      {publicationError && <p className="admin-alert error" role="alert">{publicationError}</p>}
      {!people.length && <p className="field-hint">{t("Your characters will appear here, in the directory and on the map.")}</p>}
      {people.map(person => { const publication = publications.find(item => item.localId === person.id.slice(7)); return <article className="custom-character" key={person.id}><Portrait person={person} /><div><h3 dir="auto">{personName(person)}</h3><p dir="auto">{personTitle(person)}</p><small>{countryName(person.country)} · {text(roleLabels[person.role])}</small><button className="text-link" onClick={() => onLocate(person)}><MapPin size={13} />{t("View on map")}</button><button className="secondary-button publish-character" disabled={!ready || !publicationAvailable || !!publishing || publication?.status === "pending" || publication?.status === "approved"} onClick={() => void publish(person)}><Send size={14} />{publishing === person.id ? t("Sending…") : publication?.status === "pending" ? t("Pending review") : publication?.status === "approved" ? t(publication.personId ? "Published" : "Removed from shared map") : publication?.status === "rejected" ? t("Resubmit for publication") : t("Publish character")}</button>{publication?.status === "rejected" && <p className="publication-review-note">{t("Publication request rejected.")}{publication.reviewNote && <span dir="auto"> {publication.reviewNote}</span>}</p>}</div><button className="icon-button" aria-label={t("Edit {name}", { name: personName(person) })} disabled={!ready || processing || publishing === person.id || publication?.status === "approved"} onClick={() => edit(person)}><Pencil size={16} /></button><button className="icon-button" aria-label={t("Delete {name}", { name: person.name })} disabled={publishing === person.id} onClick={() => { if (onRemove(person.id) && editingId === person.id) resetEditor(); }}><Trash2 size={16} /></button></article>; })}
    </section>
  </div>;
}
