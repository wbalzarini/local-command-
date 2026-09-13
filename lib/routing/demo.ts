import { rng, seedFrom } from "../rng";
import type { LatLng, Route } from "./types";
import type { Coordinates, SourceRef } from "@/types";

/**
 * Sample commute routes, for developing the UI with no routing key.
 *
 * Three plausible ways from southern Chester County to Newark, Delaware, with
 * the primary congested enough that the alternate recommendation and the
 * departure buffers all have something to act on. Geometry is a smoothed arc
 * between the endpoints — recognisably a line on a map, and explicitly not a
 * road: the routes carry the simulated source so the UI labels them.
 */

export const DEMO_ROUTING_SOURCE: SourceRef = {
  name: "Simulated routing data",
  kind: "demo",
};

type DemoSpec = {
  label: string;
  summary: string;
  distanceMiles: number;
  freeFlowMinutes: number;
  delayMinutes: number;
  bow: number;
};

const SPECS: DemoSpec[] = [
  { label: "Primary route", summary: "US-1 / DE-4", distanceMiles: 21.4, freeFlowMinutes: 34, delayMinutes: 9, bow: 0.02 },
  { label: "Alternate 1", summary: "PA-41 / DE-273", distanceMiles: 23.1, freeFlowMinutes: 33, delayMinutes: 2, bow: -0.06 },
  { label: "Alternate 2", summary: "US-202 / DE-141", distanceMiles: 27.8, freeFlowMinutes: 41, delayMinutes: 1, bow: 0.09 },
];

export function demoRoutes(origin: Coordinates, destination: Coordinates): Route[] {
  const random = rng(seedFrom("commute", Math.floor(Date.now() / (15 * 60_000))));

  return SPECS.map((spec, index) => {
    // A little movement per quarter hour, so the numbers behave like live data
    // rather than looking frozen, without swinging wildly.
    const jitter = random.range(-1.5, 2.5);
    const delayMinutes = Math.max(0, spec.delayMinutes + jitter);

    return {
      id: `demo-${index}`,
      label: spec.label,
      summary: spec.summary,
      distanceMiles: spec.distanceMiles,
      durationMinutes: spec.freeFlowMinutes + delayMinutes,
      freeFlowMinutes: spec.freeFlowMinutes,
      delayMinutes,
      trafficAware: true,
      geometry: arc(origin, destination, spec.bow),
      incidents:
        index === 0 && delayMinutes > 5
          ? [
              {
                id: "demo-incident-0",
                type: "congestion" as const,
                description: "Simulated slow traffic approaching the state line",
                location: "US-1 southbound",
                reportedAt: Date.now() - 22 * 60_000,
                delayMinutes: Math.round(delayMinutes),
                source: DEMO_ROUTING_SOURCE,
              },
            ]
          : [],
      isPrimary: index === 0,
    };
  });
}

/** A quadratic Bézier between the endpoints, bowed sideways by `bow` degrees. */
function arc(origin: Coordinates, destination: Coordinates, bow: number): LatLng[] {
  const midLat = (origin.lat + destination.lat) / 2;
  const midLon = (origin.lon + destination.lon) / 2;
  const dLat = destination.lat - origin.lat;
  const dLon = destination.lon - origin.lon;
  // Perpendicular offset, so each route bows to a different side.
  const controlLat = midLat + dLon * bow;
  const controlLon = midLon - dLat * bow;

  const points: LatLng[] = [];
  const steps = 48;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    const lat =
      inverse * inverse * origin.lat + 2 * inverse * t * controlLat + t * t * destination.lat;
    const lon =
      inverse * inverse * origin.lon + 2 * inverse * t * controlLon + t * t * destination.lon;
    points.push([lat, lon]);
  }
  return points;
}
