"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserCog, X } from "lucide-react";
import { canManageAdmins, type AccessRole, type AdminData, type AdministrationActions, type AtlasAccount, type ManagedCharacter, type ActionResult } from "@/lib/administration";
import { roleLabels, type Country, type Person } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import ManagedCharacterEditor from "./managed-character-editor";
import Portrait from "./portrait";
import Modal from "./modal";

const roleKeys = { owner: "Owner", admin: "Administrator", user: "User" } as const;
type Confirmation = { kind: "delete"; person: Person } | { kind: "role"; account: AtlasAccount };
export default function AdminPanel({ accessRole, countries, actions, onPeopleChange }: { accessRole: AccessRole; countries: Country[]; actions: AdministrationActions; onPeopleChange: (people: Person[]) => void }) {
  const { t, n, date, countryName, personName, personTitle, matchesPerson, periodLabel } = useI18n();
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<"submissions" | "characters" | "accounts">("submissions");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(24);
  const [accountQuery, setAccountQuery] = useState("");
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await actions.load();
      if (!response.ok) { setData(null); setError(t(response.error)); return; }
      setData(response.data); onPeopleChange(response.data.people);
    } catch { setError(t("The request could not be saved. Refresh and try again.")); }
    finally { setLoading(false); }
  }, [actions, onPeopleChange, t]);
  useEffect(() => { void reload(); }, [reload]);
  async function mutate<T>(work: () => Promise<ActionResult<T>>, success: string) {
    if (busy) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await work();
      if (!response.ok) { setError(t(response.error)); return false; }
      setMessage(success); await reload(); return true;
    } catch { setError(t("The request could not be saved. Refresh and try again.")); return false; }
    finally { setBusy(false); }
  }
  async function save(character: ManagedCharacter) {
    if (await mutate(() => actions.save(editing?.id ?? null, character), t("Shared character saved."))) setEditing(undefined);
  }
  async function confirm() {
    if (!confirmation) return;
    const done = confirmation.kind === "delete"
      ? await mutate(() => actions.remove(confirmation.person.id), t("Shared character deleted."))
      : await mutate(() => actions.setAdmin(confirmation.account.userId, confirmation.account.role !== "admin"), t("Account access updated."));
    if (done) setConfirmation(null);
  }
  const people = (data?.people ?? []).filter(person => !query || matchesPerson(person, query));
  const disabled = busy || loading;
  return <section className="admin-panel" aria-label={t("Administration panel")}>
    <div className="admin-toolbar"><div className="admin-role"><ShieldCheck size={18} /><span>{t(roleKeys[accessRole])}</span></div><button className="secondary-button" disabled={disabled} onClick={() => void reload()}><RefreshCw size={15} />{t("Refresh")}</button></div>
    <div className="admin-tabs" role="tablist" aria-label={t("Administration sections")}>
      {(["submissions", "characters", ...(canManageAdmins(accessRole) ? ["accounts"] : [])] as const).map(item => <button key={item} id={`admin-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls="admin-tab-content" onClick={() => { setTab(item as typeof tab); setEditing(undefined); }}>{item === "submissions" ? <Clock3 size={17} /> : item === "accounts" ? <UserCog size={17} /> : <Pencil size={17} />}{item === "submissions" ? t("Publication requests") : item === "accounts" ? t("Manage administrators") : t("Map characters")}{item === "submissions" && <span className="mini-count">{n(data?.submissions.length ?? 0)}</span>}</button>)}
    </div>
    {error && <p className="admin-alert error" role="alert">{error}</p>}{message && <p className="admin-alert" role="status">{message}</p>}{loading && <p className="field-hint" role="status">{t("Loading administration…")}</p>}
    <div id="admin-tab-content" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
      {data && tab === "submissions" && <><p className="field-hint">{t("Approved characters become visible to everyone on the shared map.")}</p>{!data.submissions.length && <div className="admin-empty">{t("No pending publication requests.")}</div>}<div className="admin-grid">{data.submissions.map(submission => <article className="settings-card submission-card" key={submission.id}>
        <div className="admin-person-heading"><Portrait person={submission.character as Person} /><div><h3 dir="auto">{submission.character.name}</h3><p dir="auto">{submission.character.title}</p><small>{countryName(countries.find(country => country.code === submission.character.countryCode)?.name ?? "Unknown")} · {t(roleLabels[submission.character.role])}</small></div></div>
        <p className="field-hint">{t("Submitted by {name}", { name: submission.submitterName })} · {date(submission.createdAt, { day: "numeric", month: "short", year: "numeric" })}</p>
        <p className="field-hint">{periodLabel(submission.character as Person)}</p><p className="field-hint"><bdi>{submission.character.lat}, {submission.character.lng}</bdi></p>
        <label className="admin-note">{t("Review note (optional)")}<textarea className="soft-input" maxLength={1000} value={notes[submission.id] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [submission.id]: event.target.value }))} disabled={disabled} /></label>
        <div className="admin-actions"><button className="primary-button" disabled={disabled} onClick={() => void mutate(() => actions.review(submission.id, "approved", notes[submission.id] ?? ""), t("Character approved and published."))}><Check size={16} />{t("Approve and publish")}</button><button className="secondary-button" disabled={disabled} onClick={() => void mutate(() => actions.review(submission.id, "rejected", notes[submission.id] ?? ""), t("Publication request rejected."))}><X size={16} />{t("Reject request")}</button></div>
      </article>)}</div></>}
      {data && tab === "characters" && <><div className="admin-toolbar"><label className="admin-search"><Search size={17} /><input aria-label={t("Search map characters")} placeholder={t("Search names, countries or roles…")} value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} /></label><button className="primary-button" disabled={disabled} onClick={() => setEditing(null)}><Plus size={16} />{t("Add shared character")}</button></div>
        {editing !== undefined && <ManagedCharacterEditor key={editing?.id ?? "new"} person={editing} countries={countries} busy={disabled} onSave={save} onCancel={() => setEditing(undefined)} />}
        <p className="field-hint">{t("{count} people", { count: people.length })}</p><div className="admin-grid">{people.slice(0, limit).map(person => <article className="settings-card admin-person" key={person.id}><div className="admin-person-heading"><Portrait person={person} /><div><h3>{personName(person.name)}</h3><p>{personTitle(person.title)}</p><small>{countryName(person.country)}</small></div></div><div className="admin-actions"><button className="secondary-button" disabled={disabled} onClick={() => setEditing(person)}><Pencil size={15} />{t("Edit character")}</button><button className="text-link danger" disabled={disabled} onClick={() => setConfirmation({ kind: "delete", person })}><Trash2 size={15} />{t("Delete character")}</button></div></article>)}</div>
        {!people.length && <p className="admin-empty">{t("No results found")}</p>}{people.length > limit && <button className="secondary-button" onClick={() => setLimit(previous => previous + 24)}>{t("Show more results")}</button>}
      </>}
      {data && tab === "accounts" && canManageAdmins(accessRole) && <><p className="field-hint">{t("Only the owner can appoint or remove administrators. The owner role cannot be changed here.")}</p><form className="admin-toolbar" onSubmit={async event => { event.preventDefault(); if (disabled) return; setBusy(true); setError(""); try { const response = await actions.accounts(accountQuery); if (response.ok) setData(previous => previous ? { ...previous, accounts: response.data } : previous); else setError(t(response.error)); } catch { setError(t("The request could not be saved. Refresh and try again.")); } finally { setBusy(false); } }}><label className="admin-search"><Search size={17} /><input aria-label={t("Search accounts by email or name")} placeholder={t("Search accounts by email or name")} value={accountQuery} maxLength={100} onChange={event => setAccountQuery(event.target.value)} /></label><button className="secondary-button" disabled={disabled} type="submit">{t("Search")}</button></form>
        <div className="admin-account-list">{data.accounts.map(account => <article className="settings-card admin-account" key={account.userId}><div><h3 dir="auto">{account.displayName}</h3><p><bdi>{account.email}</bdi></p><span className="publication-status">{t(roleKeys[account.role])}</span></div>{account.role !== "owner" && <button className="secondary-button" disabled={disabled} onClick={() => setConfirmation({ kind: "role", account })}><UserCog size={16} />{account.role === "admin" ? t("Remove administrator") : t("Make administrator")}</button>}</article>)}</div>{!data.accounts.length && <p className="admin-empty">{t("No results found")}</p>}
      </>}
    </div>
    {confirmation && <Modal title={confirmation.kind === "delete" ? t("Delete shared character?") : t("Change account access?")} onClose={() => { if (!busy) setConfirmation(null); }}><p className="modal-description">{confirmation.kind === "delete" ? t("Remove {name} from the shared map?", { name: personName(confirmation.person.name) }) : t("Update the administrator access for {name}?", { name: confirmation.account.email })}</p><div className="admin-actions"><button className="primary-button" disabled={disabled} onClick={() => void confirm()}>{t("Confirm")}</button><button className="secondary-button" disabled={busy} onClick={() => setConfirmation(null)}>{t("Cancel")}</button></div></Modal>}
  </section>;
}
