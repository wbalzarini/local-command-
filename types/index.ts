/**
 * Shared vocabulary for every Command Center module.
 *
 * The Today page does not know how any individual module fetches its data. It
 * only knows the shape below, which is what makes "add a module later" a
 * matter of registering one more snapshot rather than reworking the dashboard.
 */

/** Where a number on screen actually came from. Never inferred, always carried. */
export type SourceKind =
  /** A U.S. government feed (NWS, PennDOT). Authoritative for alerts. */
  | "government"
  /** A commercial weather/traffic/map provider. */
  | "provider"
  /** A police or county public-information release. */
  | "official"
  /** A news organisation reporting on a public announcement. */
  | "news"
  /** Locally generated sample data. Must always be visible as such in the UI. */
  | "demo";

export type SourceRef = {
  name: string;
  kind: SourceKind;
  /** Link to the original item, so any claim can be traced back. */
  url?: string;
  /** When this particular source was last read successfully. */
  fetchedAt?: number;
};

/**
 * The state of a module's data.
 *
 * `unavailable` is deliberately distinct from an empty result: "we could not
 * ask" must never be rendered the same way as "we asked and there is nothing".
 */
export type DataState =
  /** Fresh data from the real provider. */
  | "ok"
  /** Real data, but older than its refresh interval. Last good value shown. */
  | "stale"
  /** Some sources answered, some failed. Partial data, shown with a caveat. */
  | "degraded"
  /** The provider could not be reached and no cached value exists. */
  | "unavailable"
  /** Sample data because no API key is configured. Always labelled. */
  | "demo"
  /** Withheld behind the passcode gate (private home/work route). */
  | "locked";

export type ModuleStatus = {
  state: DataState;
  /** Shown verbatim to the user when the state is not `ok`. */
  message?: string;
  /** Last time real data arrived, for "last successful update" copy. */
  lastSuccessAt?: number;
};

export type AlertSeverity = "critical" | "important" | "advisory" | "info";

/**
 * Alert priority classes, low number = shown first.
 *
 * Ordering is a property of the alert, not of the module that raised it, so
 * that the Alert Center can rank weather against traffic against public safety
 * without special-casing any of them.
 */
export type AlertPriority =
  /** Immediate physical safety: tornado warning, flash flood warning. */
  | 1
  /** Commute disruption: closure, major accident, delay past threshold. */
  | 2
  /** Severe weather that is watched rather than warned. */
  | 3
  /** A significant change in the forecast. */
  | 4
  /** Public safety announcements. */
  | 5
  /** Everything else. */
  | 6;

export type Alert = {
  id: string;
  severity: AlertSeverity;
  priority: AlertPriority;
  /** Module that raised it, e.g. "weather", "commute". */
  module: string;
  title: string;
  body?: string;
  /** Machine-readable category for notification rules. */
  category:
    | "severe-weather"
    | "weather-change"
    | "traffic-incident"
    | "traffic-delay"
    | "road-closure"
    | "road-condition"
    | "public-safety"
    | "air-quality"
    | "system";
  issuedAt?: number;
  expiresAt?: number;
  area?: string;
  source: SourceRef;
  /** Critical alerts take over the top of the dashboard. */
  overridesLayout?: boolean;
};

/**
 * The contract every module satisfies: data, status, timestamp, alerts, summary.
 *
 * `summary` is a single sentence built only from values present in `data`. It
 * is what the Today page and the daily briefing quote, which is why modules —
 * not the briefing — own their wording: the module knows what it does and does
 * not know.
 */
export type ModuleSnapshot<T> = {
  id: string;
  label: string;
  data: T | null;
  status: ModuleStatus;
  /** When this snapshot was assembled. */
  timestamp: number;
  sources: SourceRef[];
  alerts: Alert[];
  summary: string;
};

export type Coordinates = { lat: number; lon: number };

export type NamedPlace = Coordinates & {
  /** Display label. For the home location this is deliberately not an address. */
  label: string;
  /** Full address. Server-side only for private places; never sent to the client. */
  address?: string;
  /** True when the exact address must not leave the server. */
  private?: boolean;
};

export type TrendDirection =
  | "rapidly-rising"
  | "rising"
  | "steady"
  | "falling"
  | "rapidly-falling";

export type Trend = {
  direction: TrendDirection;
  /** Signed change over the window, in the metric's own unit. */
  change: number;
  unit: string;
  windowHours: number;
};

export type StatusLevel = "good" | "moderate" | "poor" | "severe" | "unknown";

export type StatusCategory = {
  key: string;
  label: string;
  level: StatusLevel;
  /** Short reason, data-only. */
  detail: string;
  /** Points this category contributed to the day score, for transparency. */
  points: number;
};

export type DayStatus = {
  level: StatusLevel;
  label: string;
  /** 0 = nothing going on, 100 = everything wrong at once. */
  score: number;
  headline: string;
  categories: StatusCategory[];
};
