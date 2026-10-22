"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

const HOLD_DELAY_MS = 550;
const MOVE_TOLERANCE = 4;

export function useCountryHint(surface: RefObject<HTMLDivElement | null>, names: ReadonlyMap<string, string>) {
  const [hint, setHint] = useState<{ code: string; name: string } | null>(null);
  const hold = useRef<{ id: number; x: number; y: number; shown: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const blockedTap = useRef(false);
  const dismiss = useCallback(() => {
    if (hold.current?.shown) blockedTap.current = true;
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
    setHint(null);
  }, []);

  useEffect(() => {
    const otherPointer = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch" && hold.current && event.pointerId !== hold.current.id) {
        dismiss();
        blockedTap.current = true;
      }
    };
    // A second contact may land on an inspector or control outside the stage.
    window.addEventListener("pointerdown", otherPointer, true);
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      if (hold.current) clearTimeout(hold.current.timer);
      window.removeEventListener("pointerdown", otherPointer, true);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [dismiss]);

  function show(code: string, x: number, y: number) {
    const name = names.get(code);
    const element = surface.current;
    if (!name || !element) return;
    const rect = element.getBoundingClientRect();
    // Physical coordinates remain correct in both LTR and RTL layouts. Keep the
    // label above the finger, and reserve enough room for long country names.
    element.style.setProperty("--country-hint-x", `${Math.max(8, Math.min(x - rect.left + 16, rect.width - 228))}px`);
    element.style.setProperty("--country-hint-y", `${Math.max(8, Math.min(y - rect.top - 56, rect.height - 72))}px`);
    setHint(current => current?.code === code ? current : { code, name });
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    blockedTap.current = false;
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    const code = (event.target as Element).closest("[data-country]")?.getAttribute("data-country");
    if (!code || !names.has(code)) return;
    const { pointerId: id, clientX: x, clientY: y } = event;
    const timer = setTimeout(() => {
      if (hold.current?.id !== id) return;
      hold.current.shown = true;
      show(code, x, y);
    }, HOLD_DELAY_MS);
    hold.current = { id, x, y, shown: false, timer };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      const current = hold.current;
      if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_TOLERANCE) dismiss();
      return;
    }
    if (event.buttons) { dismiss(); return; }
    const code = (event.target as Element).closest("[data-country]")?.getAttribute("data-country");
    if (code) show(code, event.clientX, event.clientY);
    else dismiss();
  }
  function finish() {
    const held = (hold.current?.shown ?? false) || blockedTap.current;
    dismiss();
    blockedTap.current = false;
    return held;
  }
  return { hint, dismiss, start, move, finish, isHolding: () => hold.current !== null };
}
