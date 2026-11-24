import fs from "node:fs";
import { createHash } from "node:crypto";
import { feature } from "topojson-client";
import { geoContains, geoCentroid, geoDistance } from "d3-geo";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const world = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"));
for (const geometry of world.objects.countries.geometries) {
  if (geometry.id == null) geometry.id = `ne-${geometry.properties.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
const features = feature(world, world.objects.countries).features;
const continentNames = {
  "Africa": "Tanzania|W. Sahara|Dem. Rep. Congo|Somalia|Kenya|Sudan|Chad|South Africa|Lesotho|Zimbabwe|Botswana|Namibia|Senegal|Mali|Mauritania|Benin|Niger|Nigeria|Cameroon|Togo|Ghana|Côte d'Ivoire|Guinea|Guinea-Bissau|Liberia|Sierra Leone|Burkina Faso|Central African Rep.|Congo|Gabon|Eq. Guinea|Zambia|Malawi|Mozambique|eSwatini|Angola|Burundi|Madagascar|Gambia|Tunisia|Algeria|Eritrea|Morocco|Egypt|Libya|Ethiopia|Djibouti|Uganda|Rwanda|S. Sudan",
  "Europe": "Russia|Norway|France|Sweden|Belarus|Ukraine|Poland|Austria|Hungary|Moldova|Romania|Lithuania|Latvia|Estonia|Germany|Bulgaria|Greece|Albania|Croatia|Switzerland|Luxembourg|Belgium|Netherlands|Portugal|Spain|Ireland|Italy|Denmark|United Kingdom|Iceland|Slovenia|Finland|Slovakia|Czechia|Bosnia and Herz.|Macedonia|Serbia|Montenegro|Vatican City",
  "North America": "Canada|United States of America|Haiti|Dominican Rep.|Bahamas|Greenland|Mexico|Panama|Costa Rica|Nicaragua|Honduras|El Salvador|Guatemala|Belize|Puerto Rico|Jamaica|Cuba|Trinidad and Tobago",
  "South America": "Argentina|Chile|Falkland Is.|Uruguay|Brazil|Bolivia|Peru|Colombia|Venezuela|Guyana|Suriname|Ecuador|Paraguay",
  "Oceania": "Fiji|Papua New Guinea|Vanuatu|New Caledonia|Solomon Is.|New Zealand|Australia",
};
const region = name => name === "Somaliland" ? "Africa" : name === "Kosovo" ? "Europe" : Object.entries(continentNames).find(([, names]) => names.split("|").includes(name))?.[0] ?? (name.includes("Antarct") ? "Antarctica" : "Asia");
const countries = features.filter(f => f.id != null).map(f => {
  const [lng, lat] = geoCentroid(f);
  return { code: String(f.id), name: f.properties.name, region: region(f.properties.name, lng, lat), lat, lng };
});
countries.push({ code: "336", name: "Vatican City", region: "Europe", lat: 41.9022, lng: 12.4533 });
const findCountry = p => {
  if (p.dataset === "popes") return countries.find(c => c.code === "336");
  if (p.dataset === "iran") return countries.find(c => c.code === "364");
  if (["us", "business"].includes(p.dataset)) return countries.find(c => c.code === "840");
  // Prefer an explicit country in the original office title over a borderline
  // coordinate. No titles or political assertions are rewritten by this import.
  const aliases = { "United States of America": "United States", Turkey: "Türkiye" };
  const titled = [...countries].sort((a, b) => b.name.length - a.name.length).find(c => p.title?.includes(aliases[c.name] ?? c.name));
  if (titled) return titled;
  const f = features.find(f => geoContains(f, [p.lng, p.lat]));
  return countries.find(c => c.code === String(f?.id)) ?? [...countries].sort((a, b) => geoDistance([a.lng, a.lat], [p.lng, p.lat]) - geoDistance([b.lng, b.lat], [p.lng, p.lat]))[0];
};
const uuid = key => {
  const hash = createHash("sha256").update(`atlas:wim:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const files = { politicians: "politicians.json", iran: "Iran.json", historical: "Historical.json", popes: "popes.json", us: "US.json", business: "aaa.json" };
const people = Object.entries(files).flatMap(([dataset, file]) => JSON.parse(fs.readFileSync(`data/source/${file}`, "utf8")).map((p, index) => {
  const country = findCountry({ ...p, dataset });
  const imageUrl = p.imageUrl.startsWith("img/") ? p.imageUrl.replace("img/", "/portraits/") : p.imageUrl;
  const role = dataset === "business" ? "business" : p.role === "military" ? "army" : p.role === "political" ? "member" : p.role || "member";
  return { id: uuid(`${file}:${index}`), name: p.name, title: p.title || "Political figure", role, lat: p.lat, lng: p.lng, imageUrl: imageUrl.startsWith("/") && !fs.existsSync(`public${imageUrl}`) ? "" : imageUrl, startYear: p.startYear ?? null, endYear: p.endYear ?? null, countryCode: country.code, country: country.name, region: country.region, dataset };
}));
fs.writeFileSync("data/world.json", JSON.stringify(world));
const nato = JSON.parse(fs.readFileSync("data/source/nato-countries.json", "utf8"));
fs.writeFileSync("data/nato.json", JSON.stringify({ type: "FeatureCollection", features: nato.features.map(f => ({ type: "Feature", properties: { name: f.properties.name }, geometry: f.geometry })) }));
const sql = value => value === null ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
let seed = "-- Imported wim-main snapshot. Dates and titles are preserved, not verified as current.\nbegin;\n";
seed += "insert into public.datasets (id, name) values\n" + Object.keys(files).map(id => `(${sql(id)}, ${sql(id === "politicians" ? "World political figures" : id === "business" ? "Business leaders" : id.charAt(0).toUpperCase() + id.slice(1))})`).join(",\n") + "\non conflict (id) do update set name = excluded.name;\n";
seed += "insert into public.countries (code, name, region, latitude, longitude) values\n" + countries.map(c => `(${[c.code, c.name, c.region, c.lat, c.lng].map(sql).join(", ")})`).join(",\n") + "\non conflict (code) do update set name = excluded.name, region = excluded.region, latitude = excluded.latitude, longitude = excluded.longitude;\n";
seed += "insert into public.people (id, dataset_id, country_code, name, title, role, latitude, longitude, image_url, start_year, end_year) values\n" + people.map(p => `(${[p.id, p.dataset, p.countryCode, p.name, p.title, p.role, p.lat, p.lng, p.imageUrl, p.startYear, p.endYear].map(sql).join(", ")})`).join(",\n") + "\non conflict (id) do update set name = excluded.name, title = excluded.title, role = excluded.role, image_url = excluded.image_url, start_year = excluded.start_year, end_year = excluded.end_year, country_code = excluded.country_code;\n";
seed += `insert into public.geopolitical_layers (id, name, geojson, note) values ('nato', 'NATO countries', ${sql(JSON.stringify(nato))}::jsonb, 'Imported layer from wim-main. This is a static geographic snapshot, including when viewing historical dates.') on conflict (id) do nothing;\ncommit;\n`;
fs.writeFileSync("supabase/migrations/20261017000200_import_wim_data.sql", seed);

const profiles = JSON.parse(fs.readFileSync("data/source/historical-leaders.json", "utf8"));
const identities = { [uuid("US.json:1")]: uuid("US.json:0") };
const importedTerms = profiles.flatMap(({ id, name, nameFa, imageUrl, terms }) => terms.map(term => {
  if (term.id !== id) identities[term.id] = id;
  return { ...term, name, nameFa, imageUrl };
}));
const peopleById = new Map(people.map(person => [person.id, person]));
const countryByCode = new Map(countries.map(country => [country.code, country]));
const historicalCountries = new Map();
const { entities } = JSON.parse(fs.readFileSync("data/historical-boundaries/catalog.json", "utf8"));
for (const term of importedTerms) {
  const code = term.countryCode;
  if (!countryByCode.has(code)) {
    const { name, region, lat, lng } = entities[code];
    const country = { code, name, region, lat, lng };
    countryByCode.set(code, country);
    historicalCountries.set(code, country);
  }
  peopleById.set(term.id, term);
}
const writeJson = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
writeJson("data/people.json", [...peopleById.values()]);
writeJson("data/countries.json", [...countryByCode.values()]);
writeJson("data/person-identities.json", identities);

let historicalSeed = "-- Generated by scripts/import-data.mjs from the supplied historical officeholder data.\nbegin;\n";
historicalSeed += "insert into public.datasets (id, name, snapshot_label) values ('historical-leaders', 'Historical officeholders', 'User-supplied dates and titles') on conflict (id) do nothing;\n";
if (historicalCountries.size) {
  historicalSeed += "insert into public.countries (code, name, region, latitude, longitude) values\n" +
    [...historicalCountries.values()].map(c => `(${[c.code, c.name, c.region, c.lat, c.lng].map(sql).join(", ")})`).join(",\n") +
    "\non conflict (code) do nothing;\n";
}
historicalSeed += "insert into public.people (id, dataset_id, country_code, name, name_fa, title, title_fa, role, latitude, longitude, image_url, start_year, end_year) values\n" +
  importedTerms.map(p => `(${[p.id, p.dataset, p.countryCode, p.name, p.nameFa, p.title, p.titleFa, p.role, p.lat, p.lng, p.imageUrl, p.startYear, p.endYear].map(sql).join(", ")})`).join(",\n") +
  "\non conflict (id) do update set dataset_id = excluded.dataset_id, country_code = excluded.country_code, name = excluded.name, name_fa = excluded.name_fa, title = excluded.title, title_fa = excluded.title_fa, role = excluded.role, latitude = excluded.latitude, longitude = excluded.longitude, image_url = excluded.image_url, start_year = excluded.start_year, end_year = excluded.end_year;\ncommit;\n";
fs.writeFileSync("supabase/migrations/20261124000100_historical_leaders.sql", historicalSeed);
console.log(`Imported ${peopleById.size} terms, ${countryByCode.size} countries, and the original NATO layer.`);
