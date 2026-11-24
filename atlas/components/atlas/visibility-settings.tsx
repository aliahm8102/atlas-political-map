"use client";

import { EyeOff, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { roleLabels, type Role } from "@/lib/atlas";
import type { PersonProfile } from "@/lib/person-profiles";
import type { useBrowserPeople } from "./use-browser-people";

type Option<T> = { value: T; label: string };

function RulePicker<T extends string>({ label, options, selected, ready, onChange }: {
  label: string; options: Option<T>[]; selected: T[]; ready: boolean; onChange: (value: T, hidden: boolean) => void;
}) {
  const { t } = useI18n();
  const available = options.filter(option => !selected.includes(option.value));
  return <div className="visibility-rule">
    <label>
      <span>{label}</span>
      <select className="soft-input" value="" disabled={!ready || available.length === 0}
        onChange={event => { const option = available.find(item => item.value === event.target.value); if (option) onChange(option.value, true); }}>
        <option value="">{t(available.length ? "Select to hide" : "No options available")}</option>
        {available.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {selected.length > 0 && <ul className="visibility-rules">
      {selected.map(value => {
        const name = options.find(option => option.value === value)?.label ?? value;
        return <li key={value}><button type="button" className="secondary-button" disabled={!ready} aria-label={t("Show {name}", { name })} onClick={() => onChange(value, false)}>
          <bdi>{name}</bdi><X size={13} />
        </button></li>;
      })}
    </ul>}
  </div>;
}

export default function VisibilitySettings({ profiles, browser }: { profiles: PersonProfile[]; browser: ReturnType<typeof useBrowserPeople> }) {
  const { t, locale, personName } = useI18n();
  const { hidden, ready, setHidden } = browser;
  const sort = <T extends string>(options: Option<T>[]) => options.sort((a, b) => a.label.localeCompare(b.label, locale));
  const tags = [...new Set(Object.values(browser.tags).flat())].map(tag => ({ value: tag, label: tag }));
  return <section className="settings-card" aria-labelledby="visibility-heading">
    <div className="settings-card-heading"><span className="large-icon"><EyeOff size={23} /></span><div>
      <h2 id="visibility-heading">{t("Hide characters")}</h2>
      <p>{t("Hide matching characters from the map, directories and search. These choices are saved in this browser.")}</p>
    </div></div>
    <div className="visibility-fields">
      <RulePicker label={t("Tag")} options={sort(tags)} selected={hidden.tags} ready={ready} onChange={(value, hide) => setHidden("tags", value, hide)} />
      <RulePicker label={t("Group")} options={sort(browser.groups.map(group => ({ value: group.id, label: group.name })))} selected={hidden.groups} ready={ready} onChange={(value, hide) => setHidden("groups", value, hide)} />
      <RulePicker label={t("Role category")} options={sort((Object.keys(roleLabels) as Role[]).map(role => ({ value: role, label: t(roleLabels[role]) })))} selected={hidden.roles} ready={ready} onChange={(value, hide) => setHidden("roles", value, hide)} />
      <RulePicker label={t("Person")} options={sort(profiles.map(profile => ({ value: profile.id, label: personName(profile) })))} selected={hidden.people} ready={ready} onChange={(value, hide) => setHidden("people", value, hide)} />
    </div>
  </section>;
}
