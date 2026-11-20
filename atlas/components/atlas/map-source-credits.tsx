"use client";

import { rasterLayers } from "@/lib/map-layers";
import { useI18n } from "@/components/i18n/provider";

export default function MapSourceCredits() {
  const { t } = useI18n();
  return <div className="map-source-credits"><h3>{t("Map sources")}</h3>
    <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">Leaflet</a>
    <dl>{Object.entries(rasterLayers).map(([type, source]) => <div key={type}><dt>{t(source.label)}</dt><dd dir="ltr" dangerouslySetInnerHTML={{ __html: source.attribution.replaceAll("<a ", '<a target="_blank" rel="noreferrer" ') }} /></div>)}</dl>
  </div>;
}
