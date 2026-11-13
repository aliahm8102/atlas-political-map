"use client";
import { useEffect, useMemo, useState } from "react";
import { bordersAtDate, decodeHistoricalBorders, type HistoricalFeature } from "@/lib/historical-boundaries";
import { mapDate, usesHistoricalBorders } from "@/lib/country-entities";

let request: Promise<HistoricalFeature[]> | undefined;
let cached: HistoricalFeature[] | undefined;
const listeners = new Set<(data: HistoricalFeature[]) => void>();
function load() {
  request ??= fetch("/boundaries/cshapes-2.0.topojson").then(async response => {
    if (!response.ok) throw new Error("Historical boundary request failed");
    cached = decodeHistoricalBorders(await response.json());
    for (const notify of listeners) notify(cached);
    return cached;
  }).catch(error => { request = undefined; throw error; });
  return request;
}
export function useHistoricalBorders(year: number, month: number, enabled = true) {
  const historical = enabled && usesHistoricalBorders(mapDate(year, month));
  const [all, setAll] = useState(cached);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!historical) return;
    let active = true;
    const sync = (data: HistoricalFeature[]) => { if (active) { setAll(data); setError(false); } };
    listeners.add(sync);
    void load().then(data => { if (active) { setAll(data); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; listeners.delete(sync); };
  }, [historical, attempt]);
  const features = useMemo(() => historical && all ? bordersAtDate(all, mapDate(year, month)) : null, [historical, all, year, month]);
  return { historical, features, loading: historical && !all && !error, error: historical && error, retry: () => { setError(false); setAttempt(value => value + 1); } };
}
