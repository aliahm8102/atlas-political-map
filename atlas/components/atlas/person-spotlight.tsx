"use client";

import { Bookmark, CalendarDays } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { roleLabels, type Person } from "@/lib/atlas";
import { profilePeople, type PersonProfile } from "@/lib/person-profiles";
import Portrait from "./portrait";

export default function PersonSpotlight({ profile, activeTerm, bookmarked, onBookmark }: {
  profile: PersonProfile;
  activeTerm?: Person;
  bookmarked: boolean;
  onBookmark: () => void;
}) {
  const { t, personName, personTitle, periodLabel, countryName } = useI18n();
  const terms = profilePeople(profile);
  const person = activeTerm ?? terms[0];
  return <div className="person-spotlight">
    <Portrait key={profile.id} person={person} className="spotlight-portrait" />
    {activeTerm && <span className={`role-pill ${activeTerm.role}`}>{t(roleLabels[activeTerm.role])}</span>}
    <h3>{personName(person)}</h3>
    {activeTerm ? <><p>{personTitle(activeTerm)}</p><span className="person-period"><CalendarDays size={12} />{periodLabel(activeTerm)}</span></> : <p>{t("No recorded role at this date.")}</p>}
    {terms.length > 1 && <details className="person-history" open>
      <summary>{t("Role history")}</summary>
      <ul>{terms.map(term => <li key={term.id}>
        <strong>{personTitle(term)}</strong>
        <span>{countryName(term.country)} · {periodLabel(term)}</span>
      </li>)}</ul>
    </details>}
    <button className={`secondary-button bookmark-person ${bookmarked ? "is-bookmarked" : ""}`} onClick={onBookmark}>
      <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />{t(bookmarked ? "Bookmarked" : "Add bookmark")}
    </button>
  </div>;
}
