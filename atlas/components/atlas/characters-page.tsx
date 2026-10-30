"use client";

import { useState, type FormEvent } from "react";
import { Check, HardDrive, MapPin, Send, Trash2, UserPlus, X } from "lucide-react";
import { type Country, type Person, type Role, roleLabels } from "@/lib/atlas";
import { customPersonSchema, type CustomPerson } from "@/lib/browser-people";
import { useI18n } from "@/components/i18n/provider";
import Portrait from "./portrait";
import { getTimelineRange, TIMELINE_START_YEAR } from "@/lib/timeline";
import type { ActionResult, Publication } from "@/lib/administration";

type Props = { countries: Country[]; people: CustomPerson[]; ready: boolean; onAdd: (person: CustomPerson) => boolean; onRemove: (id: string) => boolean; onLocate: (person: Person) => void; publications?: Publication[]; publicationAvailable?: boolean; onPublish?: (person: CustomPerson) => Promise<ActionResult<Publication>> };
export default function CharactersPage({ countries, people, ready, onAdd, onRemove, onLocate, publications = [], publicationAvailable = false, onPublish }: Props) {
  const { t, n, countryName, text } = useI18n();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<Role>("leader");
  const [countryCode, setCountryCode] = useState(countries.find(country => country.code === "364")?.code ?? countries[0]?.code ?? "");
  const country = countries.find(country => country.code === countryCode);
  const [lat, setLat] = useState(String(country?.lat ?? 0));
  const [lng, setLng] = useState(String(country?.lng ?? 0));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publicationError, setPublicationError] = useState("");
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
      } finally { bitmap.close(); }
    } catch { setError(t("Choose a PNG, JPEG or WebP image smaller than 5 MB.")); }
    finally { setProcessing(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!country || !ready || processing) return;
    const result = customPersonSchema.safeParse({ id: `custom:${crypto.randomUUID()}`, name, title, role, lat: Number(lat), lng: Number(lng), countryCode, country: country.name, region: country.region, imageUrl, startYear: start ? Number(start) : null, endYear: end ? Number(end) : null, dataset: "custom" });
    if (!result.success) { setError(t("Check the coordinates and dates. The end year must follow the start year.")); return; }
    if (!onAdd(result.data)) { setError(t("Browser storage is full or unavailable. Your change was not saved.")); return; }
    setName(""); setTitle(""); setImageUrl(""); setStart(""); setEnd("");
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]'); if (input) input.value = "";
    setMessage(t("Character saved in this browser."));
  }
  return <div className="characters-layout">
    <section className="settings-card character-editor">
      <div className="settings-card-heading"><span className="large-icon"><UserPlus size={23} /></span><div><h2>{t("Add character")}</h2><p>{t("Create a person for your own map.")}</p></div></div>
      <p className="browser-storage-note"><HardDrive size={17} /><span>{t("Characters and marker positions are saved only in this browser for your account. Clearing browser data removes them.")}</span></p>
      <form onSubmit={submit} className="character-form">
        <label>{t("Character name")}<input className="soft-input" dir="auto" name="character-name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>{t("Office or description")}<input className="soft-input" dir="auto" name="character-title" required maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <div className="character-fields"><label>{t("Role")}<select className="soft-input" name="character-role" value={role} onChange={event => setRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label>{t("Country")}<select className="soft-input" name="character-country" value={countryCode} onChange={event => { const selected = countries.find(country => country.code === event.target.value); setCountryCode(event.target.value); if (selected) { setLat(String(selected.lat)); setLng(String(selected.lng)); } }}>{[...countries].sort((a, b) => countryName(a.name).localeCompare(countryName(b.name))).map(country => <option key={country.code} value={country.code}>{countryName(country.name)}</option>)}</select></label></div>
        <div className="character-fields"><label>{t("Latitude")}<input className="soft-input" dir="ltr" name="character-latitude" type="number" step="any" min={-90} max={90} required value={lat} onChange={event => setLat(event.target.value)} /></label><label>{t("Longitude")}<input className="soft-input" dir="ltr" name="character-longitude" type="number" step="any" min={-180} max={180} required value={lng} onChange={event => setLng(event.target.value)} /></label></div>
        <p className="field-hint">{t("Country coordinates are filled automatically. You can also drag the portrait on the map.")}</p>
        <div className="character-fields"><label>{t("Start year (optional)")}<input className="soft-input" dir="ltr" name="character-start" type="number" min={TIMELINE_START_YEAR} max={getTimelineRange().endYear} value={start} onChange={event => setStart(event.target.value)} /></label><label>{t("End year (optional)")}<input className="soft-input" dir="ltr" name="character-end" type="number" min={TIMELINE_START_YEAR} max={getTimelineRange().endYear} value={end} onChange={event => setEnd(event.target.value)} /></label></div>
        <p className="field-hint">{t("Leave dates empty to show this person throughout the timeline. The end year is excluded.")}</p>
        <label>{t("Portrait (optional)")}<input name="character-portrait" type="file" accept="image/png,image/jpeg,image/webp" disabled={processing} onChange={event => void portrait(event.target.files?.[0])} /></label>
        {imageUrl && <div className="character-portrait-preview"><Portrait key={imageUrl} person={{ name: name || "?", imageUrl, role } as Person} /><button type="button" className="text-link" onClick={() => setImageUrl("")}><X size={14} />{t("Remove portrait")}</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={!ready || processing || people.length >= 200}>{processing ? t("Preparing portrait…") : t("Save character")}<Check size={16} /></button>
        {people.length >= 200 && <p className="field-hint">{t("You can store up to 200 characters in this browser.")}</p>}
      </form>
    </section>
    <section className="settings-card character-collection"><div className="section-heading"><h2>{t("My characters")}</h2><span className="mini-count">{n(people.length)}</span></div>
      <p className="field-hint">{t("Send a character for review. It appears on the shared map only after administrator approval.")}</p>
      {!publicationAvailable && <p className="field-hint">{t(onPublish ? "Administration is not enabled yet." : "Sign in with an online account to publish characters.")}</p>}
      {publicationError && <p className="admin-alert error" role="alert">{publicationError}</p>}
      {!people.length && <p className="field-hint">{t("Your characters will appear here, in the directory and on the map.")}</p>}
      {people.map(person => { const publication = publications.find(item => item.localId === person.id.slice(7)); return <article className="custom-character" key={person.id}><Portrait person={person} /><div><h3 dir="auto">{person.name}</h3><p dir="auto">{person.title}</p><small>{countryName(person.country)} · {text(roleLabels[person.role])}</small><button className="text-link" onClick={() => onLocate(person)}><MapPin size={13} />{t("View on map")}</button><button className="secondary-button publish-character" disabled={!ready || !publicationAvailable || !!publishing || publication?.status === "pending" || publication?.status === "approved"} onClick={() => void publish(person)}><Send size={14} />{publishing === person.id ? t("Sending…") : publication?.status === "pending" ? t("Pending review") : publication?.status === "approved" ? t(publication.personId ? "Published" : "Removed from shared map") : publication?.status === "rejected" ? t("Resubmit for publication") : t("Publish character")}</button>{publication?.status === "rejected" && <p className="publication-review-note">{t("Publication request rejected.")}{publication.reviewNote && <span dir="auto"> {publication.reviewNote}</span>}</p>}</div><button className="icon-button" aria-label={t("Delete {name}", { name: person.name })} disabled={publishing === person.id} onClick={() => onRemove(person.id)}><Trash2 size={16} /></button></article>; })}
    </section>
  </div>;
}
