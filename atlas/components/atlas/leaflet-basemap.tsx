"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Viewport } from "@/lib/atlas";
import { leafletCamera, rasterLayers, type RasterMapType } from "@/lib/map-layers";
import { useI18n } from "@/components/i18n/provider";
import { useMapFullscreen } from "./map-experience";

export default function LeafletBasemap({ type, viewport, scale, width, height }: { type: RasterMapType; viewport: Viewport; scale: number; width: number; height: number }) {
  const host = useRef<HTMLDivElement>(null);
  const attribution = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [initialization, setInitialization] = useState(0);
  const { t } = useI18n();
  const { setMapType } = useMapFullscreen();
  const source = rasterLayers[type];

  useEffect(() => {
    const element = attribution.current;
    const root = element?.closest<HTMLElement>(".map-experience");
    if (!element || !root) return;
    const observer = new ResizeObserver(() => root.style.setProperty("--map-attribution-height", `${element.getBoundingClientRect().height + 8}px`));
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty("--map-attribution-height"); };
  }, []);

  useEffect(() => {
    let active = true;
    let instance: LeafletMap | undefined;
    // Leaflet accesses window during module evaluation, so load it only in the browser.
    void import("leaflet").then(L => {
      if (!active || !host.current) return;
      instance = L.map(host.current, {
        zoomControl: false, attributionControl: false, zoomSnap: 0,
        minZoom: -5, maxZoom: 23, dragging: false, touchZoom: false,
        scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false,
        zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      });
      setMap(instance);
    }).catch(() => { if (active) { setLoading(false); setFailed(true); } });
    return () => { active = false; instance?.remove(); };
  }, [initialization]);

  useLayoutEffect(() => {
    if (!map || !width || !height) return;
    const camera = leafletCamera(viewport, scale);
    map.invalidateSize({ pan: false, animate: false });
    map.setView(camera.center, camera.zoom, { animate: false });
  }, [map, viewport, scale, width, height]);

  useEffect(() => {
    if (!map) return;
    let active = true;
    let remove: (() => void) | undefined;
    void import("leaflet").then(L => {
      if (!active) return;
      const layer = L.tileLayer(source.url, {
        maxNativeZoom: source.maxZoom, maxZoom: 23, minZoom: 0,
        noWrap: true, keepBuffer: 1, updateWhenIdle: true,
        bounds: [[-85.05112878, -180], [85.05112878, 180]],
      });
      layer.on("loading", () => { setLoading(true); setFailed(false); });
      layer.on("load", () => setLoading(false));
      layer.on("tileerror", () => setFailed(true));
      layer.addTo(map);
      // Leaflet uses the layer's remove event to detach its map listeners.
      remove = () => { layer.remove(); layer.off(); };
    }).catch(() => { if (active) { setLoading(false); setFailed(true); } });
    return () => { active = false; remove?.(); };
  }, [map, source, retry]);

  return <>
    <div ref={host} className="leaflet-basemap" data-basemap={type} aria-hidden="true" />
    <div ref={attribution} className="map-attribution" dir="ltr" onPointerDown={event => event.stopPropagation()}>
      <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">Leaflet</a> | <span dangerouslySetInnerHTML={{ __html: source.attribution }} />
    </div>
    {(failed || loading) && <div className="map-load-status" role={failed ? "alert" : "status"} onPointerDown={event => event.stopPropagation()}>
      {t(failed ? "Some map tiles could not load. Check your connection or try another map." : "Loading map…")}
      {failed && <div><button type="button" className="text-link" onClick={() => { setFailed(false); setLoading(true); if (map) setRetry(value => value + 1); else setInitialization(value => value + 1); }}>{t("Retry")}</button><button type="button" className="text-link" onClick={() => setMapType("default")}>{t("Default")}</button></div>}
    </div>}
  </>;
}
