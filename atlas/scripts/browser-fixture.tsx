// Test-only component entry served by browser-qa.mjs's temporary Vite server.
// This file is never a Next.js route and cannot grant application access.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import MapCanvas from "../components/atlas/map-canvas";
import MapExperience from "../components/atlas/map-experience";
import Timeline from "../components/atlas/timeline";
import Portrait from "../components/atlas/portrait";
import people from "../data/people.json";
import { defaultSettings, defaultViewport, visiblePeople, type Person } from "../lib/atlas";
import "../app/globals.css";
import { LanguageProvider } from "../components/i18n/provider";
function MapFixture() {
  const [settings, setSettings] = useState(defaultSettings);
  const [viewport, setViewport] = useState(defaultViewport);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const filtered = visiblePeople(people as Person[], settings);
  const activePerson = filtered.find(person => person.id === selectedPerson?.id) ?? filtered.find(person => person.countryCode === selectedCountry);
  return <div className="atlas-app" data-theme="light" data-accent="sage"><main className="main-content"><MapExperience><div className="map-workspace"><section className="map-card"><MapCanvas people={filtered} settings={settings} viewport={viewport} onViewport={setViewport} selectedCountry={selectedCountry} onCountry={setSelectedCountry} onPerson={person => { setSelectedCountry(person.countryCode); setSelectedPerson(person); }} /></section><aside className="inspector">{activePerson ? <><div className="country-heading"><h2>{activePerson.country}</h2></div><div className="person-spotlight"><Portrait person={activePerson} className="spotlight-portrait" /><h3>{activePerson.name}</h3><p>{activePerson.title}</p></div><textarea aria-label="Private note" /></> : <div className="inspector-heading"><h2>Select a person on the map</h2></div>}</aside></div><Timeline settings={settings} onChange={patch => setSettings(previous => ({ ...previous, ...patch }))} /></MapExperience></main></div>;
}
createRoot(document.getElementById("root")!).render(<LanguageProvider initialLocale="en"><MapFixture /></LanguageProvider>);
