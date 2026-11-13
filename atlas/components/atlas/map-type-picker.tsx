"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Map, Mountain, Trees, Satellite, Globe2 } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";

import { useMapFullscreen } from "./map-experience";
import { rasterLayers } from "@/lib/map-layers";

const mapTypes = [
  { id: "default", label: "Default", icon: Map },
  { id: "physical", label: rasterLayers.physical.label, icon: Trees },
  { id: "topographic", label: rasterLayers.topographic.label, icon: Mountain },
  { id: "satellite", label: rasterLayers.satellite.label, icon: Satellite },
  { id: "political", label: rasterLayers.political.label, icon: Globe2 },
] as const;

export default function MapTypePicker() {
  const { mapType, setMapType, expanded } = useMapFullscreen();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(340);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const button = trigger.current?.getBoundingClientRect();
      if (!button) return;
      const card = root.current?.closest(".map-card")?.getBoundingClientRect();
      const bottom = !expanded && card ? Math.min(card.bottom, window.innerHeight) : window.innerHeight;
      setMenuHeight(Math.max(120, Math.min(340, bottom - (expanded ? button.top : button.bottom) - 16)));
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, true);
    return () => { window.removeEventListener("resize", fit); window.removeEventListener("scroll", fit, true); };
  }, [open, expanded]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
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
    <button ref={trigger} type="button" className="text-link map-type-trigger" aria-label={t("Choose map type")} title={t(mapType === "default" ? "Choose map type" : rasterLayers[mapType].label)} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      <Map size={15} /><span>{t(mapType === "default" ? "Choose map type" : rasterLayers[mapType].label)}</span><ChevronDown size={13} />
    </button>
    {open && <div id={id} className="map-type-options" style={{ maxHeight: menuHeight, overflowY: "auto" }} role="group" aria-label={t("Choose map type")}>
      {mapTypes.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`map-type-option${id === mapType ? " is-current" : ""}`} data-map-type={id} aria-pressed={id === mapType} onClick={() => { setMapType(id); setOpen(false); trigger.current?.focus(); }}>
        <span className="map-type-icon"><Icon size={21} /></span><span>{t(label)}</span>
        {id === mapType ? <span className="map-type-status"><Check size={14} />{t("Current map")}</span> : null}
      </button>)}
    </div>}
  </div>;
}
