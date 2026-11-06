"use client";

import { useCallback, useEffect, useState } from "react";
import { browserPeopleKey, emptyBrowserPeople, readBrowserPeople, writeBrowserPeople, updateBrowserPerson, removeBrowserPerson, reconcilePublications, type BrowserPeople, type CustomPerson, type MarkerPosition } from "@/lib/browser-people";
import type { Publication } from "@/lib/administration";

const noPublications: Publication[] = [];
export function useBrowserPeople(userId: string, notify: (message: string) => void, publications: Publication[] = noPublications) {
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
      const next = writeBrowserPeople(localStorage, userId, update(reconcilePublications(readBrowserPeople(localStorage, userId), publications)));
      setSnapshot({ owner: userId, data: next });
      return true;
    } catch { notify("Browser storage is full or unavailable. Your change was not saved."); return false; }
  }, [ready, userId, notify, publications]);
  useEffect(() => {
    if (!ready) return;
    const reconciled = reconcilePublications(data, publications);
    if (reconciled === data) return;
    const timer = window.setTimeout(() => mutate(previous => previous), 0);
    return () => clearTimeout(timer);
  }, [ready, data, publications, mutate]);
  // Hide approved drafts immediately, even if browser storage cannot be written.
  const visible = reconcilePublications(data, publications);
  return {
    ...visible, ready,
    add: (person: CustomPerson) => mutate(previous => ({ ...previous, people: [...previous.people, person] })),
    update: (person: CustomPerson) => !publications.some(item => item.localId === person.id.slice(7) && item.status === "approved") && mutate(previous => updateBrowserPerson(previous, person)),
    remove: (id: string) => mutate(previous => removeBrowserPerson(previous, id)),
    setTags: (id: string, tags: string[]) => mutate(previous => ({ ...previous, tags: { ...previous.tags, [id]: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))] } })),
    saveGroup: (group: BrowserPeople["groups"][number]) => mutate(previous => ({ ...previous, groups: [...previous.groups.filter(item => item.id !== group.id), group] })),
    removeGroup: (id: string) => mutate(previous => ({ ...previous, groups: previous.groups.filter(group => group.id !== id) })),
    setMembership: (personId: string, groupId: string, included: boolean) => mutate(previous => ({ ...previous, groups: previous.groups.map(group => group.id !== groupId ? group : { ...group, personIds: included ? [...new Set([...group.personIds, personId])] : group.personIds.filter(id => id !== personId) }) })),
    move: (id: string, position: MarkerPosition) => mutate(previous => ({ ...previous, positions: { ...previous.positions, [id]: position } })),
    resetPositions: () => mutate(previous => ({ ...previous, positions: {} })),
    bookmark: (id: string) => mutate(previous => ({ ...previous, bookmarks: previous.bookmarks.includes(id) ? previous.bookmarks.filter(bookmark => bookmark !== id) : [...previous.bookmarks, id] })),
  };
}
