import { env } from "../env";
import { failureMessage, fetchJson } from "../http";
import type { AlertPriority, AlertSeverity, Coordinates, SourceRef } from "@/types";
import type { WeatherAlert } from "./types";

/**
 * Severe weather alerts from the National Weather Service.
 *
 * Alerts come from NWS and only from NWS, even though the forecast provider
 * also publishes a warnings feed. A tornado warning is a legal product issued
 * by a government office; the app quotes the office rather than a reseller's
 * paraphrase of it, and shows the issuing office as the source so the user can
 * see that.
 *
 * NWS asks API clients to identify themselves in User-Agent so they can
 * contact whoever is running a misbehaving client. NWS_USER_AGENT carries it.
 */

const ALERTS_URL = "https://api.weather.gov/alerts/active";

export const NWS_SOURCE: SourceRef = {
  name: "National Weather Service",
  kind: "government",
  url: "https://www.weather.gov/",
};

type NwsAlertFeature = {
  id?: string;
  geometry?: unknown;
  properties?: {
    event?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    severity?: string;
    certainty?: string;
    urgency?: string;
    areaDesc?: string;
    sent?: string;
    effective?: string;
    expires?: string;
    ends?: string;
    senderName?: string;
    "@id"?: string;
  };
};

type NwsAlertsResponse = { features?: NwsAlertFeature[] };

export type AlertsFetch =
  | { ok: true; alerts: WeatherAlert[] }
  | { ok: false; message: string };

export async function fetchNwsAlerts(point: Coordinates): Promise<AlertsFetch> {
  const url = `${ALERTS_URL}?point=${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;

  const response = await fetchJson<NwsAlertsResponse>(url, {
    timeoutMs: 8_000,
    revalidate: 0,
    headers: {
      "User-Agent": env.nwsUserAgent(),
      Accept: "application/geo+json",
    },
  });

  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const features = response.value.features ?? [];
  const alerts = features
    .map(toAlert)
    .filter((alert): alert is WeatherAlert => alert !== null)
    // Most urgent first, so the dashboard can take the head of the list.
    .sort((a, b) => a.priority - b.priority || (b.issuedAt ?? 0) - (a.issuedAt ?? 0));

  return { ok: true, alerts };
}

function toAlert(feature: NwsAlertFeature): WeatherAlert | null {
  const properties = feature.properties;
  const event = properties?.event;
  if (!properties || !event) return null;

  const { severity, priority } = classify(event, properties.severity);

  return {
    id: feature.id ?? properties["@id"] ?? `nws-${event}-${properties.sent ?? ""}`,
    module: "weather",
    category: "severe-weather",
    event,
    severity,
    priority,
    title: event,
    body: properties.headline ?? properties.description ?? undefined,
    nwsSeverity: properties.severity,
    certainty: properties.certainty,
    urgency: properties.urgency,
    instruction: properties.instruction ?? undefined,
    area: properties.areaDesc,
    issuedAt: toMs(properties.sent ?? properties.effective),
    expiresAt: toMs(properties.expires ?? properties.ends),
    source: {
      ...NWS_SOURCE,
      name: properties.senderName ?? NWS_SOURCE.name,
      url: properties["@id"] ?? NWS_SOURCE.url,
    },
    // A warning-level product outranks the rest of the dashboard.
    overridesLayout: severity === "critical",
    geometry: feature.geometry,
  };
}

/**
 * NWS severity plus the product name decide how loud an alert is.
 *
 * The product name matters as much as the severity field: a "Watch" and a
 * "Warning" can both be tagged Severe, but a warning means it is happening
 * here now and a watch means conditions are favourable somewhere nearby.
 */
function classify(
  event: string,
  nwsSeverity: string | undefined,
): { severity: AlertSeverity; priority: AlertPriority } {
  const isWarning = /warning/i.test(event);
  const isWatch = /watch/i.test(event);

  if (nwsSeverity === "Extreme") return { severity: "critical", priority: 1 };
  if (nwsSeverity === "Severe") {
    return isWarning
      ? { severity: "critical", priority: 1 }
      : { severity: "important", priority: 3 };
  }
  if (nwsSeverity === "Moderate") {
    return isWarning
      ? { severity: "important", priority: 3 }
      : { severity: "advisory", priority: 4 };
  }
  if (isWarning) return { severity: "important", priority: 3 };
  if (isWatch) return { severity: "advisory", priority: 4 };
  return { severity: "advisory", priority: 4 };
}

function toMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}
