import type { TrendDirection } from "@/types";
import type { PressurePoint, PressureReading } from "./types";

/**
 * Barometric pressure analysis.
 *
 * Trend classification follows the standard meteorological practice of
 * reading the three-hour tendency, with the longer windows reported alongside
 * because a slow twelve-hour slide and a sharp three-hour drop mean different
 * things and the dashboard should not flatten them into one arrow.
 *
 * The interpretation strings are deliberately about stability, not outcomes.
 * Falling pressure is associated with less settled conditions; it does not
 * predict a particular storm, and the copy never says it does.
 */

/** inHg thresholds on the 3-hour tendency. */
const RAPID = 0.06;
const NOTABLE = 0.02;

export function analysePressure(
  history: PressurePoint[],
  currentInHg: number,
): PressureReading {
  const sorted = [...history].sort((a, b) => a.time - b.time);
  const now = sorted.length ? sorted[sorted.length - 1].time : Date.now();

  const change = (hours: number) => changeOver(sorted, now, hours, currentInHg);
  const change3h = change(3);
  const change6h = change(6);
  const change12h = change(12);
  const change24h = change(24);

  // The 3-hour tendency classifies the trend; with less than three hours of
  // history the app says "steady" rather than inventing a direction from two
  // adjacent samples.
  const direction = classify(change3h);

  return {
    currentInHg,
    change3h,
    change6h,
    change12h,
    change24h,
    trend: {
      direction,
      change: change3h ?? 0,
      unit: "inHg",
      windowHours: 3,
    },
    interpretation: interpret(direction, change12h ?? change6h ?? change3h),
    history: sorted,
  };
}

/**
 * Signed change over the window, using the sample nearest the window's start.
 *
 * Returns null when the history does not reach back far enough, which the UI
 * renders as "—" instead of a misleadingly small number.
 */
function changeOver(
  history: PressurePoint[],
  nowMs: number,
  hours: number,
  currentInHg: number,
): number | null {
  const target = nowMs - hours * 3_600_000;
  // Half an hour of slack, so an hourly series still satisfies a 3h window.
  const tolerance = 30 * 60_000;

  let best: PressurePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of history) {
    const distance = Math.abs(point.time - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }

  if (!best || bestDistance > tolerance) return null;
  return currentInHg - best.pressureInHg;
}

function classify(change3h: number | null): TrendDirection {
  if (change3h === null) return "steady";
  if (change3h >= RAPID) return "rapidly-rising";
  if (change3h >= NOTABLE) return "rising";
  if (change3h <= -RAPID) return "rapidly-falling";
  if (change3h <= -NOTABLE) return "falling";
  return "steady";
}

function interpret(direction: TrendDirection, longerChange: number | null): string {
  const magnitude =
    longerChange === null ? "" : ` (${longerChange >= 0 ? "+" : "−"}${Math.abs(longerChange).toFixed(2)} inHg)`;

  switch (direction) {
    case "rapidly-falling":
      return `Pressure falling rapidly${magnitude} — atmospheric conditions are becoming markedly less stable.`;
    case "falling":
      return `Pressure falling moderately${magnitude} — atmospheric conditions are becoming less stable.`;
    case "rapidly-rising":
      return `Pressure rising rapidly${magnitude} — atmospheric conditions are stabilising quickly.`;
    case "rising":
      return `Pressure rising${magnitude} — atmospheric conditions are becoming more stable.`;
    default:
      return "Pressure is steady — no meaningful change in atmospheric stability.";
  }
}
