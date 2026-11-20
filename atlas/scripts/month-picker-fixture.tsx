import { useState } from "react";
import DirectoryDateFilters from "../components/atlas/directory-date-filters";
import LanguageSwitcher from "../components/i18n/language-switcher";

export default function MonthPickerFixture() {
  const [range, setRange] = useState({ from: "2025-03", to: "2025-12" });
  const [theme, setTheme] = useState("light"), [accent, setAccent] = useState("sage");
  const [fontSize, setFontSize] = useState(100);
  return <div className="atlas-app" data-theme={theme} data-accent={accent} style={{ "--font-scale": fontSize / 100 } as React.CSSProperties}><main className="main-content" style={{ maxWidth: 900, margin: "auto" }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}><LanguageSwitcher />
      <select id="test-month-theme" aria-label="Theme" value={theme} onChange={event => setTheme(event.target.value)}>{["light", "dark", "sand", "midnight"].map(value => <option key={value}>{value}</option>)}</select>
      <select id="test-month-accent" aria-label="Accent" value={accent} onChange={event => setAccent(event.target.value)}>{["sage", "blue", "lavender", "amber", "rose"].map(value => <option key={value}>{value}</option>)}</select>
      <select id="test-month-font" aria-label="Font size" value={fontSize} onChange={event => setFontSize(Number(event.target.value))}><option value={100}>100%</option><option value={130}>130%</option></select>
      <button id="test-month-outside">Outside picker</button>
    </div><DirectoryDateFilters range={range} onChange={setRange} /><output id="test-month-range">{JSON.stringify(range)}</output>
    <div style={{ height: "70vh" }} />
  </main></div>;
}
