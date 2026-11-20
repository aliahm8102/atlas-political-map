// Isolated administration fixture: no application route or external database calls.
import { useCallback, useMemo, useRef, useState } from "react";
import AdminPanel from "../components/atlas/admin-panel";
import LanguageSwitcher from "../components/i18n/language-switcher";
import { characterPayload, managedCharacterSchema, personFromRow, type AdministrationActions } from "../lib/administration";
import type { Person } from "../lib/atlas";
import countries from "../data/countries.json";

export default function AdminMonthsFixture() {
  const store = useRef<Person[]>([{
    id: "monthly-admin-fixture", name: "Monthly administrator", title: "Office", nameFa: "شخصیت آزمایشی", titleFa: "سمت آزمایشی",
    role: "leader", countryCode: "364", country: "Iran", region: "Asia", lat: 35, lng: 51, imageUrl: "",
    startYear: 2025 + 2 / 12, endYear: 2025 + 5 / 12, dataset: "community",
  }]);
  const [visible, setVisible] = useState<Person[]>([]);
  const onPeopleChange = useCallback((people: Person[]) => setVisible(people), []);
  const actions = useMemo<AdministrationActions>(() => ({
    load: async () => ({ ok: true, data: { people: structuredClone(store.current), submissions: [], accounts: [] } }),
    save: async (id, character) => {
      const personId = id ?? crypto.randomUUID();
      const row = { ...characterPayload(managedCharacterSchema.parse(character)), id: personId, dataset_id: "community" };
      const person = personFromRow(row, countries);
      store.current = [...store.current.filter(item => item.id !== personId), person];
      return { ok: true, data: personId };
    },
    remove: async () => ({ ok: true, data: null }), review: async () => ({ ok: true, data: null }),
    accounts: async () => ({ ok: true, data: [] }), setAdmin: async () => ({ ok: true, data: null }),
  }), []);
  return <div className="atlas-app"><main className="main-content">
    <LanguageSwitcher /><AdminPanel accessRole="admin" countries={countries} actions={actions} onPeopleChange={onPeopleChange} />
    <output id="test-admin-people" hidden>{JSON.stringify(visible)}</output>
  </main></div>;
}
