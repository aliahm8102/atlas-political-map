"use client";

import { ChevronDown, ChevronRight, UsersRound, X } from "lucide-react";
import { roleLabels, type Person } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
import Portrait from "./portrait";

export default function CountryPeople({ people, onSelect }: { people: Person[]; onSelect: (person: Person) => void }) {
  const { t, personName } = useI18n();
  if (!people.length) return null;
  return <details className="country-people-disclosure">
    <summary className="secondary-button country-people-trigger"><UsersRound size={17} /><span>{t("Other people in this country")}</span><ChevronDown size={16} /></summary>
    <section className="country-people" aria-label={t("Other people in this country")}>
      <button type="button" className="text-link disclosure-close" onClick={event => { const details = event.currentTarget.closest("details")!; details.open = false; details.querySelector("summary")?.focus(); }}><X size={15} />{t("Close other people")}</button>
      {people.map(person => <button className="mini-person" key={person.id} onClick={() => onSelect(person)}><Portrait person={person} /><span><strong>{personName(person)}</strong><small>{t(roleLabels[person.role])}</small></span><ChevronRight size={13} /></button>)}
    </section>
  </details>;
}
