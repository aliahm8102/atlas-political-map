// Test-only component entry served by browser-qa.mjs's temporary Vite server.
// This file is never a Next.js route and cannot grant application access.
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import MapCanvas from "../components/atlas/map-canvas";
import MapExperience from "../components/atlas/map-experience";
import Timeline from "../components/atlas/timeline";
import { LayerControls } from "../components/atlas/preferences";
import Portrait from "../components/atlas/portrait";
import PeopleDirectory from "../components/atlas/people-directory";
import type { Publication } from "../lib/administration";
import CharactersPage from "../components/atlas/characters-page";
import { useBrowserPeople } from "../components/atlas/use-browser-people";
import countries from "../data/countries.json";
import people from "../data/people.json";
import { defaultSettings, defaultViewport, visiblePeople, type Person } from "../lib/atlas";
import "../app/globals.css";
import { LanguageProvider } from "../components/i18n/provider";
import LanguageSwitcher from "../components/i18n/language-switcher";
function MapFixture() {
  const [account, setAccount] = useState("fixture-a");
  const [directory, setDirectory] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [published, setPublished] = useState<Person[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const notify = useCallback((message: string) => setMessage(message), []);
  const browser = useBrowserPeople(account, notify, publications);
  const [settings, setSettings] = useState(defaultSettings);
  const [viewport, setViewport] = useState(defaultViewport);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const filtered = visiblePeople([...(people as Person[]), ...browser.people, ...published], settings);
  const activePerson = filtered.find(person => person.id === selectedPerson?.id) ?? filtered.find(person => person.countryCode === selectedCountry);
  return <div className="atlas-app" data-theme={settings.theme} data-accent={settings.accent} style={{ "--font-scale": settings.fontSize / 100 } as React.CSSProperties}><main className="main-content"><div className="fixture-toolbar"><button id="test-characters" onClick={() => { setDirectory(false); setEditingId(null); setEditing(!editing); }}>My characters</button><button id="test-directory" onClick={() => { setEditing(false); setDirectory(!directory); }}>Directory</button><button id="test-approve" onClick={() => { const person = browser.people[0]; if (!person) return; const personId = "aaaaaaaa-1111-4111-a111-111111111111"; setPublished([{ ...person, id: personId, dataset: "community" }]); setPublications([{ id: "fixture-publication", localId: person.id.slice(7), personId, status: "approved", reviewNote: "" }]); }}>Approve fixture character</button><button id="test-account" onClick={() => setAccount(account === "fixture-a" ? "fixture-b" : "fixture-a")}>{account}</button><span role="status">{message}</span><LanguageSwitcher /></div>{directory ? <PeopleDirectory people={filtered} browser={browser} bookmarks={browser.bookmarks} onBookmark={browser.bookmark} onLocate={person => { setSelectedPerson(person); setDirectory(false); }} onEdit={id => { setEditingId(id); setDirectory(false); setEditing(true); }} /> : editing ? <CharactersPage key={`${account}:${editingId ?? "new"}`} initialPerson={browser.people.find(person => person.id === editingId)} publications={publications} countries={countries} people={browser.people} ready={browser.ready} onAdd={browser.add} onUpdate={browser.update} onRemove={browser.remove} onLocate={person => { setSelectedCountry(person.countryCode); setSelectedPerson(person); setEditing(false); }} /> : <MapExperience><div className="map-workspace"><section className="map-card"><div className="map-card-header"><h2>The political landscape</h2></div><div className="map-subbar"><button className="text-link" id="test-map-controls" onClick={() => { setSelectedCountry(null); setSelectedPerson(null); }}>Map controls</button></div><MapCanvas positions={browser.positions} onMovePerson={browser.move} people={filtered} settings={settings} viewport={viewport} onViewport={setViewport} selectedCountry={selectedCountry} onCountry={setSelectedCountry} onPerson={person => { setSelectedCountry(person.countryCode); setSelectedPerson(person); }} /><div className="map-card-footer">Drag to explore ? Scroll to zoom</div></section><aside className="inspector">{activePerson ? <><div className="country-heading"><h2>{activePerson.country}</h2></div><div className="person-spotlight"><Portrait person={activePerson} className="spotlight-portrait" /><h3>{activePerson.name}</h3><p>{activePerson.title}</p></div><button className="text-link" onClick={() => { setSelectedCountry(null); setSelectedPerson(null); }}>Back to map controls</button></> : <><div className="inspector-heading"><h2>Map controls</h2></div><LayerControls settings={settings} onChange={patch => setSettings(previous => ({ ...previous, ...patch }))} onReset={() => setSettings(defaultSettings)} /></>}</aside></div><Timeline settings={settings} onChange={patch => setSettings(previous => ({ ...previous, ...patch }))} /></MapExperience>}</main></div>;
}
createRoot(document.getElementById("root")!).render(<LanguageProvider initialLocale={new URLSearchParams(location.search).get("locale") === "fa" ? "fa" : "en"}><MapFixture /></LanguageProvider>);
