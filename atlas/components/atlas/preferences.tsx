"use client";
import { useId, useRef, useState } from "react";
import { Moon, Sun, Check, Image, Type, Layers2, UsersRound, Shield, Landmark, Church, BriefcaseBusiness, RotateCcw, Globe2 } from "lucide-react";
import { type Settings, type Role, roleLabels, defaultSettings, regions } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import { hexToRgb, rgbToHex, type RGB } from "@/lib/accent-colors";
import ControlSection from "./control-section";
const roleIcons = { leader: Landmark, member: UsersRound, army: Shield, religious: Church, business: BriefcaseBusiness };
const themes = [
  { value: "light", label: "Soft light", icon: Sun },
  { value: "dark", label: "Quiet dark", icon: Moon },
  { value: "sand", label: "Warm sand", icon: Sun },
  { value: "midnight", label: "Midnight blue", icon: Moon },
] as const;
export function Toggle({ checked, onChange, label, description, icon: Icon }: { checked: boolean; onChange: () => void; label: string; description?: string; icon?: typeof Image }) {
  return <button className="toggle-row" role="switch" aria-checked={checked} onClick={onChange}><span className="toggle-copy">{Icon && <Icon size={17} />}<span>{label}{description && <small>{description}</small>}</span></span><span className={`switch ${checked ? "on" : ""}`}><span /></span></button>;
}
export function LayerControls({ settings, onChange, onReset, onResetPositions, canResetPositions = false }: { settings: Settings; onChange: (patch: Partial<Settings>) => void; onReset: () => void; onResetPositions?: () => void; canResetPositions?: boolean }) {
  const { t, text, n } = useI18n();
  return <div className="layer-controls" data-tour="layers">
    <ControlSection title={t("Region")}><label className="region-filter"><Globe2 size={14} /><span className="sr-only">{t("Filter by region")}</span><select aria-label={t("Filter by region")} value={settings.region} onChange={event => onChange({ region: event.target.value as Settings["region"] })}>{regions.map(region => <option key={region} value={region}>{text(region)}</option>)}</select></label></ControlSection>
    <ControlSection title={t("PEOPLE & INFLUENCE")} trailing={<span className="mini-count">{n(settings.roles.length)} / {n(5)}</span>}>
      {(Object.keys(roleLabels) as Role[]).map(role => { const Icon = roleIcons[role]; const active = settings.roles.includes(role); return <button type="button" className="layer-row" key={role} role="checkbox" aria-checked={active} onClick={() => onChange({ roles: active ? settings.roles.filter(r => r !== role) : [...settings.roles, role] })}><span className={`layer-icon ${role}`}><Icon size={15} /></span><span>{t(roleLabels[role])}</span><span className={`soft-checkbox ${active ? "checked" : ""}`}>{active && <Check size={12} strokeWidth={3} />}</span></button>; })}
    </ControlSection>
    <ControlSection title={t("GEOPOLITICAL LAYERS")}><Toggle label={t("NATO countries")} description={t("Imported geographic snapshot")} icon={Layers2} checked={settings.nato} onChange={() => onChange({ nato: !settings.nato })} />{settings.nato && <p className="layer-note">{t("This layer uses the original boundaries at every timeline date.")}</p>}</ControlSection>
    <div className="map-reset-actions"><button type="button" className="text-link reset-filters" onClick={onReset}><RotateCcw size={13} />{" " + t("Reset filters")}</button>
      {onResetPositions && <button type="button" className="text-link reset-positions" disabled={!canResetPositions} onClick={onResetPositions}>{t("Reset portrait positions")}</button>}
    </div>
  </div>;
}
function RGBChannel({ label, channel, value, onChange }: { label: string; channel: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (text: string) => /^\d{1,3}$/.test(text) && Number(text) <= 255;
  return <label>{channel}<input className="soft-input" type="number" inputMode="numeric" min={0} max={255} step={1} aria-label={label} value={draft ?? value} aria-invalid={draft !== null && !valid(draft)} onFocus={() => setDraft(String(value))} onChange={event => { const text = event.target.value; setDraft(text); if (valid(text)) onChange(Number(text)); }} onBlur={() => setDraft(null)} /></label>;
}
export function AppearanceControls({ settings, onChange, compact = false }: { settings: Settings; onChange: (patch: Partial<Settings>) => void; compact?: boolean }) {
  const { t, text, n } = useI18n();
  const fontSizeId = useId();
  const customGroupId = useId(), customInput = useRef<HTMLInputElement>(null);
  const rgb = hexToRgb(settings.customAccent);
  return <div className={`appearance-controls ${compact ? "compact" : ""}`}>
    <ControlSection title={t("COLOR THEME")}><div className="theme-choices">{themes.map(({ value: theme, label, icon: Icon }) => <button key={theme} aria-pressed={settings.theme === theme} className={`theme-choice ${theme} ${settings.theme === theme ? "selected" : ""}`} onClick={() => onChange({ theme })}><div className="theme-preview"><span /><span /><span /></div><span><Icon size={14} /><span>{t(label)}</span>{settings.theme === theme && <Check size={13} />}</span></button>)}</div></ControlSection>
    <ControlSection title={t("ACCENT COLOR")}><div className="accent-choices">
      {(["sage", "blue", "lavender", "amber", "rose"] as const).map(accent => <button key={accent} className={`accent-choice ${accent} ${settings.accent === accent ? "selected" : ""}`} aria-label={text(accent)} aria-pressed={settings.accent === accent} onClick={() => onChange({ accent })}>{settings.accent === accent && <Check size={16} />}<span>{text(accent)}</span></button>)}
      <button type="button" className={`accent-choice custom ${settings.accent === "custom" ? "selected" : ""}`} aria-label={t("Your color")} aria-pressed={settings.accent === "custom"} aria-controls={settings.accent === "custom" ? customGroupId : undefined} onClick={() => { onChange({ accent: "custom" }); customInput.current?.click(); }}>{settings.accent === "custom" && <Check size={16} />}<span>{t("Your color")}</span></button>
    </div><input ref={customInput} hidden type="color" name="custom-accent-color" aria-label={t("Choose your color")} value={settings.customAccent} onChange={event => onChange({ accent: "custom", customAccent: event.target.value })} />
    {settings.accent === "custom" && <div id={customGroupId} className="custom-accent-rgb" role="group" aria-label={t("Your color (RGB)")}>
      <span className="custom-accent-preview" style={{ backgroundColor: settings.customAccent }} aria-hidden="true" />
      <div className="custom-accent-channels" dir="ltr">{(["R", "G", "B"] as const).map((channel, index) => <RGBChannel key={channel} channel={channel} label={t(index === 0 ? "Red (R)" : index === 1 ? "Green (G)" : "Blue (B)")} value={rgb[index]} onChange={value => { const next: RGB = [...rgb]; next[index] = value; onChange({ accent: "custom", customAccent: rgbToHex(next) }); }} />)}</div>
      <output dir="ltr">{`RGB(${rgb.join(", ")})`}</output>
    </div>}</ControlSection>
    <ControlSection title={t("Font size")} className="font-size-control" trailing={<output htmlFor={fontSizeId}>{n(settings.fontSize / 100, { style: "percent" })}</output>}>
      <label className="sr-only" htmlFor={fontSizeId}>{t("Font size")}</label><input id={fontSizeId} type="range" min={90} max={130} step={10} value={settings.fontSize} aria-valuetext={n(settings.fontSize / 100, { style: "percent" })} onChange={event => onChange({ fontSize: Number(event.target.value) })} /><p className="font-size-preview">{t("Make Atlas comfortable to read.")}</p>
    </ControlSection>
    <ControlSection title={t("MAP DETAILS")}><Toggle label={t("Portrait markers")} icon={Image} checked={settings.portraits} onChange={() => onChange({ portraits: !settings.portraits })} /><Toggle label={t("Continent labels")} icon={Type} checked={settings.labels} onChange={() => onChange({ labels: !settings.labels })} /><label className="size-label">{t("Marker size")}</label><div className="segmented-control">{(["small", "medium", "large"] as const).map(markerSize => <button key={markerSize} className={settings.markerSize === markerSize ? "active" : ""} aria-pressed={settings.markerSize === markerSize} onClick={() => onChange({ markerSize })}>{text(markerSize)}</button>)}</div></ControlSection>
    {!compact && <button className="secondary-button" onClick={() => onChange({ theme: defaultSettings.theme, accent: defaultSettings.accent, customAccent: defaultSettings.customAccent, fontSize: defaultSettings.fontSize, portraits: true, labels: true, markerSize: "medium" })}><RotateCcw size={15} />{" " + t("Reset appearance")}</button>}
  </div>;
}
