// Keep the existing decimal-year representation used by the monthly timeline and publication API.
export function characterDateFields(value: number | null | undefined) {
  if (value == null) return { year: "", month: 0 };
  const year = Math.floor(value);
  return { year: String(year), month: Math.max(0, Math.min(11, Math.round((value - year) * 12))) };
}

export function characterDateValue(year: string, month: number): number | null {
  if (!year.trim()) return null;
  const value = Number(year);
  if (!Number.isInteger(value) || !Number.isInteger(month) || month < 0 || month > 11) return NaN;
  return value + month / 12;
}
