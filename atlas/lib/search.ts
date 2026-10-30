import { regions, roleLabels, type Country, type Person, type Role } from "./atlas.ts";
import { createTranslator, type Locale } from "./i18n/index.ts";
import { getTimelineRange, TIMELINE_START_YEAR } from "./timeline.ts";

export type SearchState = { query: string; type: "all" | "person" | "place"; region: string; role: string; year: string; sort: "relevance" | "name" | "newest" };
export const defaultSearchState: SearchState = { query: "", type: "all", region: "", role: "", year: "", sort: "relevance" };
export type SearchDocument = { id: string; type: "person" | "place"; name: string; faName: string; region: string; person?: Person; country?: Country; fields: { tokens: string[]; weight: number }[] };
export type SearchHit = { document: SearchDocument; score: number; approximate: boolean };

export function normalizeQuery(text: string) {
  return text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[يىئ]/g, "ی").replace(/ك/g, "ک").replace(/[أإآ]/g, "ا").replace(/[ةۀ]/g, "ه")
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function stem(word: string) {
  if (/^[a-z]+$/.test(word)) {
    if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  }
  for (const suffix of ["هایی", "های", "ترین", "ها", "ان"]) if (/[\u0600-\u06ff]/.test(word) && word.endsWith(suffix) && word.length - suffix.length >= 4) return word.slice(0, -suffix.length);
  return word;
}
const words = (text: string) => normalizeQuery(text).split(" ").filter(Boolean).map(stem);
const groups: Record<string, string[]> = {
  intentpresident: ["president", "presidency", "رئیس جمهور", "رییس جمهور", "روسای جمهور", "رئیس جمهوری"],
  intentpremier: ["prime minister", "premier", "نخست وزیر", "نخستوزیر", "صدراعظم", "chancellor"],
  intentmilitary: ["military", "army", "armed forces", "soldier", "commander", "نظامی", "ارتش", "ارتشی", "فرمانده", "نیروهای مسلح"],
  intentgovernment: ["government", "politician", "political", "دولت", "دولتمرد", "سیاستمدار", "سیاسی"],
  intentreligious: ["religious", "religion", "cleric", "مذهبی", "دینی", "روحانیون"],
  intentbusiness: ["business", "entrepreneur", "businessman", "کسب و کار", "تجارت", "تاجر", "کارافرین"],
  intentleader: ["leader", "leadership", "head of state", "رهبر", "رهبران", "سران کشورها"],
  intentmonarch: ["king", "queen", "monarch", "پادشاه", "ملکه", "سلطان"],
  intentforeign: ["foreign minister", "minister of foreign affairs", "وزیر خارجه", "وزیر امور خارجه"],
  intentdefence: ["defense minister", "defence minister", "minister of defense", "minister of defence", "وزیر دفاع"],
};
const phrases = Object.entries(groups).flatMap(([tag, aliases]) => aliases.map(alias => ({ tag, phrase: words(alias).join(" ") }))).sort((a, b) => b.phrase.length - a.phrase.length);
const stop = new Set(words("the of in on at a an and who is are find search show me people person places country countries for from during در به از و را با برای اشخاص افراد مکان کشور کشورهای جستجو پیدا کن نمایش بده چه کسی کیست سال ها های هایی"));
function tokens(text: string) {
  let value = ` ${words(text).join(" ")} `;
  for (const { tag, phrase } of phrases) value = value.split(` ${phrase} `).join(` ${tag} `);
  return [...new Set(value.trim().split(/\s+/).filter(word => word && !stop.has(word)))];
}
const countryAliases: Record<string, string[]> = {
  "United States of America": ["USA", "US", "United States", "America", "ایالات متحده", "امریکا", "ایالاتمتحده"],
  "United Kingdom": ["UK", "Britain", "Great Britain", "British", "بریتانیا", "انگلیس", "انگلستان"],
  Iran: ["Persia", "Iranian", "پرشیا", "ایرانی"], Russia: ["Russian", "Russian Federation", "روسی", "فدراسیون روسیه"],
  Germany: ["German", "Deutschland", "المان", "المانی"], France: ["French", "فرانسوی"], China: ["Chinese", "چینی"],
  "United Arab Emirates": ["UAE", "امارات", "امارات متحده"], "Saudi Arabia": ["Saudi", "عربستان", "سعودی"],
  Turkey: ["Türkiye", "Turkiye", "Turkish", "ترکیه", "ترکی"], "South Korea": ["Republic of Korea", "کره جنوبی"],
  "North Korea": ["DPRK", "کره شمالی"], "Netherlands": ["Holland", "هلند"],
};
const regionAliases: Record<string, string> = { Europe: "European اروپایی", Asia: "Asian اسیایی", Africa: "African افریقایی", "North America": "امریکای شمالی", "South America": "امریکای جنوبی", Oceania: "اقیانوسیه" };
const roleTags: Record<Role, string> = { leader: "intentleader", member: "intentgovernment", army: "intentmilitary", religious: "intentreligious", business: "intentbusiness" };

export function buildSearchIndex(people: Person[], countries: Country[]): SearchDocument[] {
  const fa = createTranslator("fa");
  const field = (text: string, weight: number) => ({ tokens: tokens(text), weight });
  const location = (name: string, region: string) => `${name} ${fa.countryName(name)} ${(countryAliases[name] ?? []).join(" ")} ${region} ${fa.text(region)} ${regionAliases[region] ?? ""}`;
  return [
    ...countries.map(country => ({ id: `place:${country.code}`, type: "place" as const, name: country.name, faName: fa.countryName(country.name), region: country.region, country, fields: [field(`${country.name} ${fa.countryName(country.name)} ${(countryAliases[country.name] ?? []).join(" ")}`, 9), field(location(country.name, country.region), 2)] })),
    ...people.map(person => {
      const title = tokens(`${person.title} ${fa.personTitle(person.title)}`);
      const tags = [roleTags[person.role], ...(title.some(token => ["intentpresident", "intentpremier", "intentmonarch"].includes(token)) ? ["intentleader"] : [])];
      return { id: `person:${person.id}`, type: "person" as const, name: person.name, faName: fa.personName(person.name), region: person.region, person, fields: [field(`${person.name} ${fa.personName(person.name)}`, 10), { tokens: [...title, ...tags], weight: 5 }, field(location(person.country, person.region), 3)] };
    }),
  ];
}

// Optimal-string-alignment distance: insertion, deletion, replacement and
// adjacent transposition. Bound token lengths before running the small matrix.
export function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 3 || a.length > 48 || b.length > 48) return 4;
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}
function activeInYear(person: Person, year: number) { return (person.startYear === null || person.startYear < year + 1) && (person.endYear === null || person.endYear > year); }
export function searchAtlas(index: SearchDocument[], state: SearchState, locale: Locale = "en") {
  const query = normalizeQuery(state.query.slice(0, 160));
  const queryTokens = tokens(query).filter(word => !/^\d{4}$/.test(word)).slice(0, 12);
  const queryYear = query.match(/(?:^|\s)((?:19|20)\d{2})(?:\s|$)/)?.[1];
  const rawWords = words(query);
  const explicitType = rawWords.some(word => ["country", "place", "کشور", "مکان"].includes(word)) ? "place" : rawWords.some(word => ["people", "person", "اشخاص", "افراد"].includes(word)) ? "person" : "all";
  const type = state.type === "all" ? explicitType : state.type;
  const year = state.type === "place" ? "" : state.year || queryYear;
  const eligible = index.filter(doc => (type === "all" || doc.type === type) && (!state.region || doc.region === state.region) && (!state.role || doc.person?.role === state.role) && (!year || (doc.person && activeInYear(doc.person, Number(year)))));
  function rank(fuzzy: boolean) {
    return eligible.flatMap(document => {
      let score = 0, approximate = false;
      for (const word of queryTokens) {
        let best = 0;
        for (const field of document.fields) for (const candidate of field.tokens) {
          if (candidate === word) best = Math.max(best, field.weight * 10);
          else if (word.length >= 2 && candidate.startsWith(word)) best = Math.max(best, field.weight * 7);
          else if (fuzzy && word.length >= 4 && !word.startsWith("intent") && editDistance(word, candidate) <= (word.length >= 7 ? 2 : 1)) best = Math.max(best, field.weight * 3);
        }
        if (!best) return [];
        if (fuzzy && !document.fields.some(field => field.tokens.some(candidate => candidate === word || candidate.startsWith(word)))) approximate = true;
        score += best;
      }
      if (query && [document.name, document.faName].some(name => normalizeQuery(name) === query)) score += 500;
      return [{ document, score, approximate }];
    });
  }
  let hits = rank(false);
  if (!hits.length && queryTokens.length) hits = rank(true);
  hits.sort((a, b) => {
    if (state.sort === "newest") { const aYear = a.document.person?.startYear ?? -Infinity, bYear = b.document.person?.startYear ?? -Infinity; if (aYear !== bYear) return aYear > bYear ? -1 : 1; if (a.document.type !== b.document.type) return a.document.type === "person" ? -1 : 1; }
    if (state.sort === "relevance" && a.score !== b.score) return b.score - a.score;
    return (locale === "fa" ? a.document.faName : a.document.name).localeCompare(locale === "fa" ? b.document.faName : b.document.name, locale) || a.document.id.localeCompare(b.document.id);
  });
  return hits;
}

export function alternativeQueries(index: SearchDocument[], query: string, locale: Locale) {
  const terms = tokens(query).filter(term => term.length >= 3 && !term.startsWith("intent"));
  return index.map(document => ({ document, distance: Math.min(10, ...terms.flatMap(term => document.fields[0].tokens.map(token => editDistance(term, token)))) }))
    .filter(item => item.distance <= (terms.some(term => term.length >= 6) ? 3 : 1)).sort((a, b) => a.distance - b.distance).slice(0, 4).map(({ document }) => locale === "fa" ? document.faName : document.name);
}

export function parseSearchState(params: URLSearchParams): SearchState {
  const type = params.get("type"), sort = params.get("sort"), year = params.get("year") ?? "";
  const region = params.get("region") ?? "", role = params.get("role") ?? "";
  return { query: (params.get("q") ?? "").slice(0, 160), type: type === "person" || type === "place" ? type : "all", region: regions.some(value => value === region && value !== "All regions") ? region : "", role: Object.hasOwn(roleLabels, role) && type !== "place" ? role : "", year: /^\d{4}$/.test(year) && Number(year) >= TIMELINE_START_YEAR && Number(year) <= getTimelineRange().endYear && type !== "place" ? year : "", sort: sort === "name" || sort === "newest" ? sort : "relevance" };
}
export function searchUrl(state: SearchState) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  for (const key of ["type", "region", "role", "year", "sort"] as const) if (state[key] !== defaultSearchState[key]) params.set(key, state[key]);
  return `/workspace/search${params.size ? `?${params}` : ""}`;
}
