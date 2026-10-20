"use client";

import { useCallback, useEffect, useState } from "react";
import { browserPeopleKey, emptyBrowserPeople, readBrowserPeople, writeBrowserPeople, type BrowserPeople, type CustomPerson, type MarkerPosition } from "@/lib/browser-people";

export function useBrowserPeople(userId: string, notify: (message: string) => void) {
  const [snapshot, setSnapshot] = useState<{ owner: string; data: BrowserPeople } | null>(null);
  const ready = snapshot?.owner === userId;
  const data = ready ? snapshot.data : emptyBrowserPeople;
  useEffect(() => {
    const restore = () => {
      try { setSnapshot({ owner: userId, data: readBrowserPeople(localStorage, userId) }); }
      catch { setSnapshot({ owner: userId, data: emptyBrowserPeople }); notify("Your browser could not restore your characters."); }
    };
    restore();
    const sync = (event: StorageEvent) => { if (event.key === browserPeopleKey(userId) || event.key === null) restore(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [userId, notify]);

  const mutate = useCallback((update: (previous: BrowserPeople) => BrowserPeople) => {
    if (!ready) return false;
    try {
      // Read before writing so another tab's changes are preserved.
      const next = writeBrowserPeople(localStorage, userId, update(readBrowserPeople(localStorage, userId)));
      setSnapshot({ owner: userId, data: next });
      return true;
    } catch { notify("Browser storage is full or unavailable. Your change was not saved."); return false; }
  }, [ready, userId, notify]);
  return {
    ...data, ready,
    add: (person: CustomPerson) => mutate(previous => ({ ...previous, people: [...previous.people, person] })),
    remove: (id: string) => mutate(previous => ({ ...previous, people: previous.people.filter(person => person.id !== id), bookmarks: previous.bookmarks.filter(bookmark => bookmark !== id), positions: Object.fromEntries(Object.entries(previous.positions).filter(([key]) => key !== id)) })),
    move: (id: string, position: MarkerPosition) => mutate(previous => ({ ...previous, positions: { ...previous.positions, [id]: position } })),
    resetPositions: () => mutate(previous => ({ ...previous, positions: {} })),
    bookmark: (id: string) => mutate(previous => ({ ...previous, bookmarks: previous.bookmarks.includes(id) ? previous.bookmarks.filter(bookmark => bookmark !== id) : [...previous.bookmarks, id] })),
  };
}
