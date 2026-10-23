"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Map, Mountain, Trees } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";

const mapTypes = [
  { id: "default", label: "Default", icon: Map },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "natural", label: "Natural", icon: Trees },
] as const;

export default function MapTypePicker() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={root} className="map-type-picker" data-tour="map-type" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="text-link map-type-trigger" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      <Map size={15} /><span>{t("Choose map type")}</span><ChevronDown size={13} />
    </button>
    {open && <div id={id} className="map-type-options" role="group" aria-label={t("Choose map type")}>
      {mapTypes.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`map-type-option${id === "default" ? " is-current" : ""}`} data-map-type={id} disabled>
        <span className="map-type-icon"><Icon size={21} /></span><span>{t(label)}</span>
        {id === "default" ? <span className="map-type-status"><Check size={14} />{t("Current map")}</span> : <span className="map-type-status">{t("Coming soon")}</span>}
      </button>)}
    </div>}
  </div>;
}
