"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { initialPersonalState, localStateSchema, type PersonalState, type Settings } from "@/lib/atlas";
export function usePersonalState(mode: "local" | "account", userId: string | undefined, initial: PersonalState | undefined, notify: (message: string) => void) {
  const storageKey = `atlas-local-v1:${userId}`;
  const [state, setState] = useState<PersonalState>(initial ?? initialPersonalState);
  const [ready, setReady] = useState(mode === "account");
  const [sync, setSync] = useState<"local" | "saving" | "saved" | "error">(mode === "local" ? "local" : "saved");
  const [retryCount, setRetryCount] = useState(0);
  const first = useRef(true);
  const preferenceRequest = useRef(0);
  const preferenceQueue = useRef(Promise.resolve());
  const pending = useRef(new Set<string>());
  /* eslint-disable react-hooks/set-state-in-effect -- Browser storage is an external source restored after SSR; persistence failures must update the UI. */
  useEffect(() => {
    if (mode !== "local") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const parsed = localStateSchema.safeParse(JSON.parse(raw)); if (parsed.success) setState(parsed.data); }
    } catch { notify("Your browser could not restore the previous demo session."); }
    setReady(true);
  }, [mode, notify, storageKey]);
  useEffect(() => {
    if (!ready || mode !== "local") return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); setSync("local"); }
    catch { setSync("error"); notify("Browser storage is unavailable. These changes will last only for this session."); }
  }, [state, ready, mode, notify, retryCount, storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "account" || !ready) return;
    if (first.current) { first.current = false; return; }
    const requestId = ++preferenceRequest.current;
    setSync("saving");
    const timeout = setTimeout(() => { preferenceQueue.current = preferenceQueue.current.then(async () => {
      try {
        const { error } = await createClient().from("user_preferences").upsert({ user_id: userId, settings: state.settings });
        if (error) throw error;
        if (requestId === preferenceRequest.current) setSync("saved");
      } catch { if (requestId === preferenceRequest.current) { setSync("error"); notify("Preferences could not sync. Use Retry to save them again."); } }
    }); }, 650);
    return () => clearTimeout(timeout);
  }, [state.settings, ready, mode, userId, retryCount, notify]);
  const settings = useCallback((patch: Partial<Settings>) => setState(s => ({ ...s, settings: { ...s.settings, ...patch } })), []);
  const operation = useCallback(async (key: string, remote: () => PromiseLike<{ error: unknown }>, local: () => void, message?: string) => {
    if (pending.current.has(key)) return false;
    pending.current.add(key);
    try {
      if (mode === "account") { const { error } = await remote(); if (error) throw error; }
      local(); if (message) notify(message); return true;
    } catch { notify("That change could not be saved. Please try again."); return false; }
    finally { pending.current.delete(key); }
  }, [mode, notify]);
  const bookmark = useCallback((id: string) => {
    const exists = state.bookmarks.includes(id);
    return operation(`bookmark:${id}`, () => exists ? createClient().from("bookmarks").delete().eq("user_id", userId).eq("person_id", id) : createClient().from("bookmarks").insert({ user_id: userId, person_id: id }), () => setState(s => ({ ...s, bookmarks: exists ? s.bookmarks.filter(b => b !== id) : [...s.bookmarks, id] })), exists ? "Bookmark removed" : "Added to your bookmarks");
  }, [state.bookmarks, operation, userId]);
  const saveNote = useCallback((countryCode: string, body: string) => operation(`note:${countryCode}`, () => createClient().from("country_notes").upsert({ user_id: userId, country_code: countryCode, body }), () => setState(s => ({ ...s, notes: { ...s.notes, [countryCode]: body } })), "Private note saved"), [operation, userId]);
  const saveName = useCallback((name: string) => operation("profile", () => createClient().from("profiles").update({ display_name: name }).eq("id", userId), () => setState(s => ({ ...s, displayName: name })), "Profile updated"), [operation, userId]);
  return { state, ready, sync, settings, bookmark, saveNote, saveName, retry: () => setRetryCount(c => c + 1) };
}
