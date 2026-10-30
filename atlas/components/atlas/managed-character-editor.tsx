"use client";
import { useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { roleLabels, type Country, type Person, type Role } from "@/lib/atlas";
import { managedCharacterSchema, type ManagedCharacter } from "@/lib/administration";
import { getTimelineRange } from "@/lib/timeline";
import { useI18n } from "@/components/i18n/provider";

export default function ManagedCharacterEditor({ person, countries, busy, onSave, onCancel }: { person: Person | null; countries: Country[]; busy: boolean; onSave: (character: ManagedCharacter) => Promise<void>; onCancel: () => void }) {
  const { t, countryName } = useI18n();
  const country = countries.find(country => country.code === (person?.countryCode ?? "364")) ?? countries[0];
  const [name, setName] = useState(person?.name ?? "");
  const [title, setTitle] = useState(person?.title ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "leader");
  const [countryCode, setCountryCode] = useState(country?.code ?? "");
  const [lat, setLat] = useState(String(person?.lat ?? country?.lat ?? 0));
  const [lng, setLng] = useState(String(person?.lng ?? country?.lng ?? 0));
  const [start, setStart] = useState(person?.startYear == null ? "" : String(person.startYear));
  const [end, setEnd] = useState(person?.endYear == null ? "" : String(person.endYear));
  const [imageUrl, setImageUrl] = useState(person?.imageUrl ?? "");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  async function portrait(file?: File) {
    if (!file) return;
    setProcessing(true); setError("");
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error();
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas"), scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d"); if (!context) throw new Error();
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); setImageUrl(canvas.toDataURL("image/webp", .8));
      } finally { bitmap.close(); }
    } catch { setError(t("Choose a PNG, JPEG or WebP image smaller than 5 MB.")); }
    finally { setProcessing(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || processing) return;
    const parsed = managedCharacterSchema.safeParse({ name, title, role, countryCode, lat: Number(lat), lng: Number(lng), startYear: start === "" ? null : Number(start), endYear: end === "" ? null : Number(end), imageUrl });
    if (!parsed.success) { setError(t("Check the character details and try again.")); return; }
    setError(""); await onSave(parsed.data);
  }
  return <section className="settings-card admin-editor"><div className="section-heading"><h2>{person ? t("Edit shared character") : t("Add shared character")}</h2><button type="button" className="icon-button" onClick={onCancel} disabled={busy} aria-label={t("Cancel")}><X size={18} /></button></div>
    <form className="character-form" onSubmit={submit}><fieldset disabled={busy || processing}>
      <label>{t("Character name")}<input className="soft-input" name="admin-name" dir="auto" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>{t("Office or description")}<input className="soft-input" name="admin-title" dir="auto" required maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <div className="character-fields"><label>{t("Role")}<select className="soft-input" value={role} onChange={event => setRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
        <label>{t("Country")}<select className="soft-input" value={countryCode} onChange={event => { setCountryCode(event.target.value); const next = countries.find(country => country.code === event.target.value); if (next) { setLat(String(next.lat)); setLng(String(next.lng)); } }}>{countries.map(country => <option key={country.code} value={country.code}>{countryName(country.name)}</option>)}</select></label></div>
      <div className="character-fields"><label>{t("Latitude")}<input className="soft-input" name="admin-lat" dir="ltr" type="number" step="any" min={-90} max={90} required value={lat} onChange={event => setLat(event.target.value)} /></label><label>{t("Longitude")}<input className="soft-input" name="admin-lng" dir="ltr" type="number" step="any" min={-180} max={180} required value={lng} onChange={event => setLng(event.target.value)} /></label></div>
      <div className="character-fields"><label>{t("Start year (optional)")}<input className="soft-input" name="admin-start" dir="ltr" type="number" step="any" min={0} max={getTimelineRange().endYear + .999} value={start} onChange={event => setStart(event.target.value)} /></label><label>{t("End year (optional)")}<input className="soft-input" name="admin-end" dir="ltr" type="number" step="any" min={0} max={getTimelineRange().endYear + .999} value={end} onChange={event => setEnd(event.target.value)} /></label></div>
      <label>{t("Portrait URL (optional)")}<input className="soft-input" name="admin-image" dir="ltr" value={imageUrl} maxLength={300000} onChange={event => setImageUrl(event.target.value)} /></label>
      <label>{t("Portrait (optional)")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void portrait(event.target.files?.[0])} /></label>
    </fieldset>{error && <p role="alert" className="form-error">{error}</p>}<div className="admin-actions"><button className="primary-button" type="submit" disabled={busy || processing}><Check size={16} />{busy ? t("Saving…") : t("Save character")}</button><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>{t("Cancel")}</button></div></form>
  </section>;
}
