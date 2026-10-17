// Test-only component entry served by browser-qa.mjs's temporary Vite server.
// This file is never a Next.js route and cannot grant application access.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import MapCanvas from "../components/atlas/map-canvas";
import people from "../data/people.json";
import { defaultSettings, defaultViewport, visiblePeople, type Person } from "../lib/atlas";
import "../app/globals.css";
import { LanguageProvider } from "../components/i18n/provider";
function MapFixture() {
  const [viewport, setViewport] = useState(defaultViewport);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  return <div className="atlas-app" data-theme="light" data-accent="sage"><MapCanvas people={visiblePeople(people as Person[], defaultSettings)} settings={defaultSettings} viewport={viewport} onViewport={setViewport} selectedCountry={selectedCountry} onCountry={setSelectedCountry} onPerson={person => setSelectedCountry(person.countryCode)} /></div>;
}
createRoot(document.getElementById("root")!).render(<LanguageProvider initialLocale="en"><MapFixture /></LanguageProvider>);
