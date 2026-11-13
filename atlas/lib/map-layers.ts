import type { Viewport } from "./atlas.ts";

const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
export const rasterLayers = {
  physical: {
    label: "Physical Map", maxZoom: 8,
    url: `${esri}/World_Physical_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; US National Park Service',
  },
  topographic: {
    label: "Topographic Map", maxZoom: 17,
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
  satellite: {
    label: "Satellite Imagery", maxZoom: 19,
    url: `${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Vantor, Earthstar Geographics, and the GIS User Community',
  },
  political: {
    label: "Political Map", maxZoom: 19,
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>',
  },
} as const;
export type RasterMapType = keyof typeof rasterLayers;
export type MapType = "default" | RasterMapType;

// Match the SVG Mercator world, centered at (500, 270) and 1000 units wide.
export const geographicExtent = { x: 0, y: -230, width: 1000, height: 1000 };
export function leafletCamera(view: Viewport, scale: number) {
  const x = (500 - view.x) / view.k, y = (270 - view.y) / view.k;
  const lng = x / 1000 * 360 - 180;
  const lat = Math.atan(Math.sinh((270 - y) * 2 * Math.PI / 1000)) * 180 / Math.PI;
  return { center: [lat, lng] as [number, number], zoom: Math.log2(1000 * view.k * scale / 256) };
}
export function geographicMaxZoom(type: RasterMapType, scale: number) {
  return Math.max(1, 256 * 2 ** rasterLayers[type].maxZoom / (1000 * scale));
}
