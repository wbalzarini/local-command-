import type { Coordinates, SourceRef, StatusLevel } from "@/types";

/** [latitude, longitude] pairs, the order Leaflet expects. */
export type LatLng = [number, number];

export type IncidentType =
  | "accident"
  | "construction"
  | "closure"
  | "congestion"
  | "disabled-vehicle"
  | "weather"
  | "other";

export type RouteIncident = {
  id: string;
  type: IncidentType;
  description: string;
  /** Road or cross-street as the reporting agency described it. */
  location?: string;
  reportedAt?: number;
  /** Only set when the reporting source states a delay. Never estimated here. */
  delayMinutes?: number | null;
  coordinates?: Coordinates;
  source: SourceRef;
};

export type Route = {
  id: string;
  label: string;
  /** Road names along the route, when the provider names them. */
  summary: string;
  distanceMiles: number;
  /** Travel time the provider expects right now. */
  durationMinutes: number;
  /** Travel time with no traffic. The baseline "normal" for this route. */
  freeFlowMinutes: number | null;
  /** Current minus free-flow. Null when the provider has no traffic model. */
  delayMinutes: number | null;
  /** False when the time is a free-flow estimate with no live traffic in it. */
  trafficAware: boolean;
  geometry: LatLng[] | null;
  incidents: RouteIncident[];
  isPrimary: boolean;
};

export type RoadRisk = "low" | "moderate" | "high";

export type CommuteImpact = {
  trafficMinutes: number | null;
  precipProbability: number | null;
  visibilityMiles: number | null;
  windGust: number | null;
  roadRisk: RoadRisk;
  /** Minutes the weather alone argues for leaving early. */
  weatherBufferMinutes: number;
  /** Factors that actually contributed, for showing the working. */
  factors: string[];
  recommendation: string;
};

export type DepartureRecommendation = {
  /** Target arrival, as configured in Settings ("08:00"). */
  arrivalTarget: string;
  arrivalAt: number;
  departAt: number;
  driveMinutes: number;
  trafficBufferMinutes: number;
  weatherBufferMinutes: number;
  totalMinutes: number;
  /** True when the recommended departure is already in the past. */
  overdue: boolean;
};

export type RouteRecommendation = {
  routeId: string;
  label: string;
  savingsMinutes: number;
  reason: string;
};

export type CommuteData = {
  origin: { label: string };
  destination: { label: string; address?: string };
  routes: Route[];
  primary: Route | null;
  /** Null when no alternate beats the primary by more than the threshold. */
  recommendation: RouteRecommendation | null;
  normalMinutes: number | null;
  currentMinutes: number | null;
  delayMinutes: number | null;
  level: StatusLevel;
  trafficAware: boolean;
  impact: CommuteImpact;
  departure: DepartureRecommendation | null;
  inCommuteWindow: boolean;
  /** Provider that produced the timings, for the source badge. */
  provider: SourceRef;
};

export type RouteRequest = {
  origin: Coordinates;
  destination: Coordinates;
  /** Number of alternates to ask for, on top of the primary. */
  alternates: number;
};

export type RouteFetch =
  | { ok: true; routes: Route[]; provider: SourceRef; trafficAware: boolean }
  | { ok: false; message: string };

/** What every routing provider implements. Swapping providers is one file. */
export type RoutingProvider = {
  id: string;
  source: SourceRef;
  trafficAware: boolean;
  route(request: RouteRequest): Promise<RouteFetch>;
};
