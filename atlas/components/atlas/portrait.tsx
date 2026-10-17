"use client";
import { useState } from "react";
import { initials, type Person } from "@/lib/atlas";
import { useI18n } from "@/components/i18n/provider";
export default function Portrait({ person, className = "" }: { person: Person; className?: string }) {
  const { personName } = useI18n();
  const [failed, setFailed] = useState(false);
  return <span className={`portrait ${className}`} data-role={person.role} role="img" aria-label={personName(person.name)}><span className="portrait-fallback" aria-hidden="true">{initials(personName(person.name))}</span>{!failed && person.imageUrl && <img src={person.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" />}</span>;
}
