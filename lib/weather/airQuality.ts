import { failureMessage, fetchJson } from "../http";
import { TIME_ZONE } from "../format";
import type { Coordinates, SourceRef } from "@/types";
import type { AirQualityData } from "./types";

/**
 * Air quality from Open-Meteo's CAMS-backed air quality API. No key required.
 *
 * Pollen is requested but is only published for European locations, so for
 * Avondale it comes back null — and is reported as "not published for this
 * location" rather than omitted, so an empty pollen row reads as a gap in the
 * data rather than as clean air.
 */

const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export const AIR_QUALITY_SOURCE: SourceRef = {
  name: "Open-Meteo Air Quality (CAMS)",
  kind: "provider",
  url: "https://open-meteo.com/en/docs/air-quality-api",
};

const FIELDS = ["us_aqi", "pm2_5", "pm10", "ozone", "aerosol_optical_depth"].join(",");

type AirQualityResponse = { current?: Record<string, number | null> };

export type AirQualityFetch =
  | { ok: true; data: AirQualityData }
  | { ok: false; message: string };

export async function fetchAirQuality(
  point: Coordinates,
): Promise<AirQualityFetch> {
  const url =
    `${AIR_QUALITY_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
    `&current=${FIELDS}&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime`;

  const response = await fetchJson<AirQualityResponse>(url, {
    timeoutMs: 8_000,
    revalidate: 0,
  });

  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const current = response.value.current;
  if (!current) {
    return { ok: false, message: "Provider response was missing current values" };
  }

  const aqi = numeric(current.us_aqi);
  const { category, label } = categorise(aqi);

  return {
    ok: true,
    data: {
      observedAt: (numeric(current.time) ?? Math.floor(Date.now() / 1000)) * 1000,
      aqi,
      category,
      label,
      pm25: numeric(current.pm2_5),
      pm10: numeric(current.pm10),
      ozone: numeric(current.ozone),
      smokeIndex: numeric(current.aerosol_optical_depth),
      pollen: null,
      summary: summarise(aqi, category, numeric(current.pm2_5)),
    },
  };
}

function numeric(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** U.S. EPA AQI breakpoints. */
function categorise(aqi: number | null): {
  category: AirQualityData["category"];
  label: string;
} {
  if (aqi === null) return { category: "unknown", label: "UNKNOWN" };
  if (aqi <= 50) return { category: "good", label: "GOOD" };
  if (aqi <= 100) return { category: "moderate", label: "MODERATE" };
  if (aqi <= 150) return { category: "unhealthy-sensitive", label: "UNHEALTHY (SENSITIVE)" };
  if (aqi <= 200) return { category: "unhealthy", label: "UNHEALTHY" };
  if (aqi <= 300) return { category: "very-unhealthy", label: "VERY UNHEALTHY" };
  return { category: "hazardous", label: "HAZARDOUS" };
}

function summarise(
  aqi: number | null,
  category: AirQualityData["category"],
  pm25: number | null,
): string {
  if (aqi === null) return "Air quality data unavailable.";
  const pm = pm25 === null ? "" : ` PM2.5 at ${pm25.toFixed(1)} µg/m³.`;
  switch (category) {
    case "good":
      return `AQI ${Math.round(aqi)} — air quality is good.${pm}`;
    case "moderate":
      return `AQI ${Math.round(aqi)} — acceptable, with a minor concern for unusually sensitive people.${pm}`;
    case "unhealthy-sensitive":
      return `AQI ${Math.round(aqi)} — sensitive groups should limit prolonged exertion outdoors.${pm}`;
    case "unhealthy":
      return `AQI ${Math.round(aqi)} — everyone should limit prolonged exertion outdoors.${pm}`;
    case "very-unhealthy":
      return `AQI ${Math.round(aqi)} — avoid prolonged exertion outdoors.${pm}`;
    default:
      return `AQI ${Math.round(aqi)} — hazardous; stay indoors where possible.${pm}`;
  }
}
