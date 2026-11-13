import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const revision = "bfadee4f951682c29970e53677707bc558e80b74";
const source = `https://raw.githubusercontent.com/restcountries/restcountries/${revision}/src/main/resources/countriesV3.1.json`;
const read = async file => JSON.parse(await fs.readFile(file, "utf8"));
const reference = process.argv[2] ? await read(process.argv[2]) : await (await fetch(source)).json();
if (!Array.isArray(reference) || reference.length < 200) throw new Error("Invalid reference dataset");
const countries = await read("data/countries.json"), samples = await read("data/source/country-profile-samples.json");
const legacyFa = (await read("data/locales/fa-data.json")).countries;
const supplements = samples.filter(([code]) => !countries.some(country => country.code === code)).map(([code]) => {
  const row = reference.find(row => row.ccn3 === code);
  return { code, name: row.name.common, region: "Europe", lat: row.latlng[0], lng: row.latlng[1] };
});
const capitalsFa = { Tehran: "تهران", Kabul: "کابل", Baghdad: "بغداد", Ankara: "آنکارا", Beijing: "پکن", Tokyo: "توکیو", Seoul: "سئول", Pyongyang: "پیونگ‌یانگ", "New Delhi": "دهلی نو", Islamabad: "اسلام‌آباد", Riyadh: "ریاض", Doha: "دوحه", "Abu Dhabi": "ابوظبی", Muscat: "مسقط", Cairo: "قاهره", Damascus: "دمشق", Beirut: "بیروت", Amman: "امان", "Washington, D.C.": "واشینگتن، دی.سی.", Ottawa: "اتاوا", Canberra: "کانبرا", Wellington: "ولینگتون", Brasília: "برازیلیا", "Buenos Aires": "بوئنوس آیرس", Santiago: "سانتیاگو", Pretoria: "پرتوریا", "Cape Town": "کیپ‌تاون", Bloemfontein: "بلومفونتین", Nairobi: "نایروبی", Pristina: "پریشتینا", Tbilisi: "تفلیس", Yerevan: "ایروان", Baku: "باکو" };
const manifest = {}, profiles = {};
await fs.mkdir("public/flags", { recursive: true });
const downloads = [];
for (const country of [...countries, ...supplements]) {
  const row = reference.find(row => row.ccn3 && row.ccn3 === country.code || row.name.common === country.name);
  if (row && !/^[A-Z]{2}$/.test(row.cca2)) throw new Error(`Invalid flag code for ${country.code}`);
  const sample = samples.find(([code]) => code === country.code);
  const capitals = row?.capital ?? [];
  const profile = { ...country, nameEn: sample?.[2] ?? row?.name.common ?? country.name, nameFa: sample?.[1] ?? legacyFa[country.name] ?? row?.translations?.per?.common ?? country.name, capital: capitals.join(" / ") || null, capitalFa: sample?.[3] ?? (capitals.length ? capitals.map(capital => capitalsFa[capital] ?? capital).join(" / ") : null), areaKm2: sample?.[4] ?? row?.area ?? null, population: sample?.[5] ?? row?.population ?? null, flag: row ? `/flags/${row.cca2.toLowerCase()}.svg` : `/flags/${country.code}.svg`, source: sample ? "provided" : row ? "restcountries" : "unavailable" };
  profiles[country.code] = profile;
  if (row) {
    const flagUrl = `https://raw.githubusercontent.com/hampusborgos/country-flags/c09927e63705529bbf59ca6684cd9b23225dddad/svg/${row.cca2.toLowerCase()}.svg`;
    downloads.push({ path: `public${profile.flag}`, url: flagUrl, svg: true }); manifest[profile.flag] = flagUrl;
  } else {
    const filename = country.code === "ne-n-cyprus" ? "Flag_of_the_Turkish_Republic_of_Northern_Cyprus.svg" : "Flag_of_Somaliland.svg";
    const hash = createHash("md5").update(filename).digest("hex");
    const flagUrl = `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${filename}`;
    downloads.push({ path: `public${profile.flag}`, url: flagUrl, svg: true }); manifest[profile.flag] = flagUrl;
  }
}
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < downloads.length) {
    const download = downloads[next++];
    try { if ((await fs.stat(download.path)).size > 0) continue; } catch {}
    const response = await fetch(download.url);
    if (!response.ok) throw new Error(`Flag download failed: ${download.url} (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (download.svg) {
      const svg = buffer.toString();
      if (!svg.includes("<svg") || /<script\b|<foreignObject\b|\bonload\s*=|(?:href|src)=["'](?:https?:|\/\/|javascript:)/i.test(svg)) throw new Error("Unsafe flag SVG");
    } else if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Invalid flag PNG");
    await fs.writeFile(download.path, buffer);
  }
}));
await fs.writeFile("data/country-profiles.json", JSON.stringify(profiles, null, 2) + "\n");
await fs.writeFile("data/source/country-profiles-provenance.json", JSON.stringify({ reference: source, snapshotDate: "2026-11-13", sample: "country-profile-samples.json (user-provided reference figures; observation years unspecified)", note: "Reference figures are a snapshot, not a live census or timeline reconstruction. Missing facts remain null.", flags: manifest }, null, 2) + "\n");
console.log(`Imported ${Object.keys(profiles).length} profiles and ${downloads.length} local flags; preserved ${samples.length} supplied samples.`);
