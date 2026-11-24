import type { Person } from "./atlas.ts";
import identities from "../data/person-identities.json" with { type: "json" };

// Existing record IDs identify terms. Explicit links keep people with the same name distinct.
const aliases = new Map(Object.entries(identities));
export const personProfileId = (id: string) => aliases.get(id) ?? id;
const byLatestTerm = (a: Person, b: Person) =>
  (b.startYear ?? -Infinity) - (a.startYear ?? -Infinity) || a.id.localeCompare(b.id);

type PersonIdentity = Pick<Person, "name" | "nameFa" | "imageUrl">;
type PersonTerm = Omit<Person, keyof PersonIdentity>;
export type PersonProfile = PersonIdentity & { id: string; terms: PersonTerm[] };

export function buildPersonProfiles(records: Person[]) {
  const groups = new Map<string, Person[]>();
  for (const record of records) {
    const id = personProfileId(record.id);
    const group = groups.get(id);
    if (group) group.push(record);
    else groups.set(id, [record]);
  }
  return new Map<string, PersonProfile>(Array.from(groups, ([id, group]) => {
    group.sort(byLatestTerm);
    const primary = group.find(record => record.id === id) ?? group[0];
    return [id, {
      id,
      name: primary.name,
      nameFa: primary.nameFa || group.find(record => record.nameFa)?.nameFa,
      imageUrl: primary.imageUrl || group.find(record => record.imageUrl)?.imageUrl || "",
      terms: group.map(({ name, nameFa, imageUrl, ...term }) => {
        // Strip identity fields from the term while preserving its legacy record ID.
        void name; void nameFa; void imageUrl;
        return term;
      }),
    }];
  }));
}

export function profilePeople(profile: PersonProfile): Person[] {
  const { name, nameFa, imageUrl } = profile;
  return profile.terms.map(term => ({ ...term, name, nameFa, imageUrl }));
}

export function uniquePeople(records: Person[], byCountry = false) {
  const people = new Map<string, Person>();
  for (const record of records) {
    const id = personProfileId(record.id);
    const key = byCountry ? `${id}:${record.countryCode}` : id;
    const previous = people.get(key);
    if (!previous || byLatestTerm(record, previous) < 0) people.set(key, record);
  }
  return [...people.values()];
}
