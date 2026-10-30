// Isolated UI fixture: in-memory data, no Supabase calls, never an application route.
import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import AdminPanel from "../components/atlas/admin-panel";
import CharactersPage from "../components/atlas/characters-page";
import { LanguageProvider } from "../components/i18n/provider";
import { canManageAtlas, canManageAdmins, managedCharacterSchema } from "../lib/administration";
import countries from "../data/countries.json";
import people from "../data/people.json";
import "../app/globals.css";

const draft = { id: "custom:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", name: "کاراکتر نمونه", title: "ارسال برای بررسی", role: "leader", countryCode: "364", country: "Iran", region: "Asia", lat: 35, lng: 51, imageUrl: "", startYear: null, endYear: null, dataset: "custom" };
const denied = () => ({ ok: false, error: "You do not have permission to manage Atlas." });
function Fixture() {
  const [role, setRole] = useState("user");
  const [view, setView] = useState("characters");
  const [drafts, setDrafts] = useState([draft]);
  const [, render] = useState(0);
  const [visiblePeople, setVisiblePeople] = useState(people.slice(0, 3));
  const store = useRef({ people: people.slice(0, 3), submissions: [], publications: [], accounts: [
    { userId: "11111111-1111-4111-a111-111111111111", displayName: "مالک آزمایشی", email: "owner@example.test", role: "owner" },
    { userId: "33333333-3333-4333-a333-333333333333", displayName: "ادمین آزمایشی", email: "admin@example.test", role: "admin" },
    { userId: "44444444-4444-4444-a444-444444444444", displayName: "کاربر آزمایشی", email: "user@example.test", role: "user" },
  ] });
  function asPerson(character, id = crypto.randomUUID()) {
    const country = countries.find(country => country.code === character.countryCode);
    return { ...character, id, country: country.name, region: country.region, dataset: "community" };
  }
  const actions = useMemo(() => ({
    load: async () => canManageAtlas(role) ? { ok: true, data: structuredClone({ people: store.current.people, submissions: store.current.submissions, accounts: canManageAdmins(role) ? store.current.accounts : [] }) } : denied(),
    save: async (id, character) => {
      if (!canManageAtlas(role)) return denied();
      const person = asPerson(managedCharacterSchema.parse(character), id ?? crypto.randomUUID());
      store.current.people = [...store.current.people.filter(item => item.id !== person.id), person];
      return { ok: true, data: person.id };
    },
    remove: async id => { if (!canManageAtlas(role)) return denied(); store.current.people = store.current.people.filter(person => person.id !== id); return { ok: true, data: null }; },
    review: async (id, decision, note) => {
      if (!canManageAtlas(role)) return denied();
      const submission = store.current.submissions.find(item => item.id === id);
      if (!submission) return { ok: false, error: "The request could not be saved. Refresh and try again." };
      const person = decision === "approved" ? asPerson(submission.character) : null;
      if (person) store.current.people.push(person);
      store.current.submissions = store.current.submissions.filter(item => item.id !== id);
      store.current.publications = store.current.publications.map(item => item.id === id ? { ...item, status: decision, reviewNote: note, personId: person?.id ?? null } : item);
      render(previous => previous + 1); return { ok: true, data: person?.id ?? null };
    },
    accounts: async query => canManageAdmins(role) ? { ok: true, data: store.current.accounts.filter(account => `${account.email} ${account.displayName}`.includes(query)) } : denied(),
    setAdmin: async (userId, makeAdmin) => {
      if (!canManageAdmins(role) || store.current.accounts.find(account => account.userId === userId)?.role === "owner") return denied();
      store.current.accounts = store.current.accounts.map(account => account.userId === userId ? { ...account, role: makeAdmin ? "admin" : "user" } : account);
      return { ok: true, data: null };
    },
  }), [role]);
  async function publish(person) {
    const localId = person.id.slice(7);
    const existing = store.current.publications.find(item => item.localId === localId);
    if (existing && existing.status !== "rejected") return { ok: true, data: existing };
    const publication = { id: existing?.id ?? crypto.randomUUID(), localId, status: "pending", reviewNote: "", personId: null };
    store.current.publications = [...store.current.publications.filter(item => item.localId !== localId), publication];
    store.current.submissions.push({ ...publication, submitterName: "کاربر آزمایشی", createdAt: new Date().toISOString(), character: managedCharacterSchema.parse(person) });
    render(previous => previous + 1); return { ok: true, data: publication };
  }
  return <div className="atlas-app"><main className="main-content" style={{ maxWidth: 1180, margin: "auto" }}><div className="admin-toolbar" style={{ marginBottom: 24 }}><label>سطح دسترسی آزمایشی <select aria-label="سطح دسترسی آزمایشی" value={role} onChange={event => { setRole(event.target.value); setView(event.target.value === "user" ? "characters" : "admin"); }}><option value="user">کاربر</option><option value="admin">ادمین</option><option value="owner">مالک</option></select></label><button className="secondary-button" onClick={() => setView("characters")}>شخصیت‌های من</button>{canManageAtlas(role) && <button className="secondary-button" onClick={() => setView("admin")}>پنل مدیریتی</button>}<span>پیش‌نمایش با داده‌های آزمایشی · {visiblePeople.length} شخصیت روی نقشه</span></div>
    {view === "admin" && canManageAtlas(role) ? <AdminPanel key={role} accessRole={role} countries={countries} actions={actions} onPeopleChange={setVisiblePeople} /> : <CharactersPage countries={countries} people={drafts} ready publicationAvailable publications={store.current.publications} onPublish={publish} onAdd={person => { setDrafts(previous => [...previous, person]); return true; }} onRemove={id => { setDrafts(previous => previous.filter(person => person.id !== id)); return true; }} onLocate={() => {}} />}</main></div>;
}
createRoot(document.getElementById("root")).render(<LanguageProvider initialLocale="fa"><Fixture /></LanguageProvider>);
