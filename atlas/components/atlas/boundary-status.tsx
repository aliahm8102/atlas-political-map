"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";

export default function BoundaryStatus({ loading, error, date, retry, nato }: { loading: boolean; error: boolean; date: string; retry: () => void; nato: boolean }) {
  const { t, date: formatDate } = useI18n();
  const label = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = label.current, root = element?.closest<HTMLElement>(".map-experience");
    if (!element || !root) return;
    const observer = new ResizeObserver(() => root.style.setProperty("--map-boundary-status-height", `${element.getBoundingClientRect().height + 8}px`));
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty("--map-boundary-status-height"); };
  }, []);
  return <div ref={label} className="map-boundary-status" role={error ? "alert" : "status"} onPointerDown={event => event.stopPropagation()}>
    {loading ? t("Loading historical borders…") : error ? <>{t("Historical borders could not load.")} <button className="text-link" onClick={retry}>{t("Retry")}</button></> : <>{t("Historical borders on {date}", { date: formatDate(date, { day: "numeric", month: "short", year: "numeric" }) })} · <a href="https://icr.ethz.ch/data/cshapes/" target="_blank" rel="noreferrer">CShapes 2.0</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a></>}
    {nato && <span className="boundary-nato-note">{t("No NATO membership data is available for this historical view.")}</span>}
  </div>;
}
