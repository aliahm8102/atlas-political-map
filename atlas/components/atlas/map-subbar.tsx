"use client";

import { MapPinned } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import MapTypePicker from "./map-type-picker";

export default function MapSubbar({ count, year, month }: { count: number; year: number; month: number }) {
  const { t, n, date } = useI18n();
  return <div className="map-subbar">
    <div className="map-subbar-title"><span className="map-heading-icon"><MapPinned size={19} strokeWidth={1.5} /></span><h2>{t("The political landscape")}</h2></div>
    <div className="map-view-label"><span>{n(count)}{" " + t("figures in this view")}</span><span className="map-subbar-divider">·</span><span>{date(new Date(Date.UTC(year, month, 1)))}</span></div>
    <MapTypePicker />
  </div>;
}
