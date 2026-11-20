import { useCallback, useState } from "react";
import { AppearanceControls } from "../components/atlas/preferences";
import { usePersonalState } from "../components/atlas/use-personal-state";
import LanguageSwitcher from "../components/i18n/language-switcher";
import { customAccentStyle } from "../lib/accent-colors";
import { defaultViewport } from "../lib/atlas";
import MapExperience from "../components/atlas/map-experience";
import MapCanvas from "../components/atlas/map-canvas";
import Timeline from "../components/atlas/timeline";

export default function CustomAccentFixture() {
  const notify = useCallback(() => {}, []);
  const personal = usePersonalState("local", "fixture-accent", undefined, notify);
  const settings = personal.state.settings;
  const [viewport, setViewport] = useState(defaultViewport);
  return <div className="atlas-app" data-ready={personal.ready} data-theme={settings.theme} data-accent={settings.accent} style={{ "--font-scale": settings.fontSize / 100, ...customAccentStyle(settings) } as React.CSSProperties & { "--font-scale": number }}><main className="main-content">
    <LanguageSwitcher /><section className="settings-card"><AppearanceControls settings={settings} onChange={personal.settings} /><button id="test-accent-preview" type="button" className="primary-button">Preview action</button></section>
    <MapExperience><div className="map-workspace"><section className="map-card"><MapCanvas people={[]} settings={settings} viewport={viewport} onViewport={setViewport} selectedCountry={null} onCountry={() => {}} onPerson={() => {}} /></section><aside className="inspector">Map controls</aside></div><Timeline settings={settings} onChange={personal.settings} /></MapExperience>
  </main></div>;
}
