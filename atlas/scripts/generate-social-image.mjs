// Reproducible local artwork; no external fonts, services or map tile requests.
import fs from "node:fs/promises";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const world = JSON.parse(await fs.readFile(new URL("../data/world.json", import.meta.url), "utf8"));
const countries = feature(world, world.objects.countries);
const land = { ...countries, features: countries.features.filter(item => item.properties.name !== "Antarctica") };
const projection = geoNaturalEarth1().fitExtent([[70, 190], [1130, 555]], land);
const map = geoPath(projection)(land);
const dots = [[51.4,35.7],[13.4,52.5],[-77,38.9],[139.7,35.7],[-47.9,-15.8]].map(coordinate => {
  const [x,y] = projection(coordinate);
  return `<circle cx="${x}" cy="${y}" r="10" fill="#547b63" opacity=".14"/><circle cx="${x}" cy="${y}" r="4" fill="#3c614a"/>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#e9eeeb"/><rect x="20" y="20" width="1160" height="590" rx="24" fill="#edf1ee" stroke="#d7dfd8"/>
<circle cx="1090" cy="90" r="33" fill="none" stroke="#547b63" stroke-width="2"/><ellipse cx="1090" cy="90" rx="16" ry="33" fill="none" stroke="#547b63" stroke-width="2"/><path d="M1057 90h66m-61-17h56m-56 34h56" stroke="#547b63" fill="none"/>
<text x="80" y="106" fill="#2d3d33" font-family="Georgia,serif" font-size="58">Atlas Peyma</text>
<text x="82" y="148" fill="#547b63" font-family="Arial,sans-serif" font-size="23">Explore geography, history &amp; politics</text>
<path d="${map}" fill="#cddace" stroke="#edf1ee" stroke-width=".8"/>${dots}
<path d="M80 580h1040" stroke="#d7dfd8"/><text x="82" y="600" fill="#3c614a" font-family="Arial,sans-serif" font-size="16">1886 — today</text><text x="1120" y="600" text-anchor="end" fill="#3c614a" font-family="Arial,sans-serif" font-size="16">atlas-peyma.ir</text></svg>`;
const output = new URL("../public/social/atlas-peyma.png", import.meta.url);
await fs.mkdir(new URL("../public/social/", import.meta.url), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(output));
console.log("Generated public/social/atlas-peyma.png (1200 × 630).");
