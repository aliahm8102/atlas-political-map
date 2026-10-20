"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const FullscreenContext = createContext({ expanded: false, pending: false, toggle: async () => {} });
export const useMapFullscreen = () => useContext(FullscreenContext);

export default function MapExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [pending, setPending] = useState(false);
  const expanded = native || fallback;

  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFallback(false);
      if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);

  async function toggle() {
    const element = root.current;
    if (!element || pending) return;
    if (fallback) { setFallback(false); return; }
    setPending(true);
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else if (element.requestFullscreen && document.fullscreenEnabled) await element.requestFullscreen();
      else setFallback(true);
    } catch {
      if (document.fullscreenElement !== element) setFallback(true);
    } finally { setPending(false); }
  }

  return <FullscreenContext.Provider value={{ expanded, pending, toggle }}>
    <div ref={root} className={`map-experience${expanded ? " map-expanded" : ""}`} data-fullscreen={native ? "native" : fallback ? "fallback" : "off"}>{children}</div>
  </FullscreenContext.Provider>;
}
