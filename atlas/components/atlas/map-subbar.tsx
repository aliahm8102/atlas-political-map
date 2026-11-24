"use client";

import { MapPinned } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import MapTypePicker from "./map-type-picker";
import { utcMonth } from "@/lib/timeline";

export default function MapSubbar({ count, year, month }: { count: number; year: number; month: number }) {
  const { t, n, date } = useI18n();
  return <div className="map-subbar">
    <div className="map-subbar-title"><span className="map-heading-icon"><MapPinned size={19} strokeWidth={1.5} /></span><h2>{t("The political landscape")}</h2></div>
    <div className="map-view-label"><span>{n(count)}<span className="map-view-description">{" " + t("figures in this view")}</span></span><span className="map-subbar-divider">·</span><span>{date(utcMonth(year, month))}</span></div>
    <MapTypePicker />
  </div>;
}
