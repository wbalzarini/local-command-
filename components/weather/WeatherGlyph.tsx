import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { condition } from "@/lib/weather/conditions";

/**
 * The condition glyph.
 *
 * Driven by the WMO code's family plus whether it is daylight, so a clear
 * night gets a moon rather than a sun — a small thing that stops the hourly
 * strip looking wrong at a glance. The accessible name comes from the code's
 * own label, so the icon is never the only carrier of the information.
 */

const BY_FAMILY: Record<string, LucideIcon> = {
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: Zap,
};

const TONE: Record<string, string> = {
  clear: "text-series-temp",
  cloud: "text-muted",
  fog: "text-faint",
  drizzle: "text-series-rain",
  rain: "text-series-rain",
  snow: "text-info",
  storm: "text-level-moderate",
};

export function WeatherGlyph({
  code,
  isDay = true,
  className = "size-5",
  label,
}: {
  code: number;
  isDay?: boolean;
  className?: string;
  /** Overrides the accessible name; omit to use the condition label. */
  label?: string;
}) {
  const info = condition(code);
  const Icon =
    info.family === "clear"
      ? isDay
        ? code === 0
          ? Sun
          : CloudSun
        : Moon
      : (BY_FAMILY[info.family] ?? Cloud);

  return (
    <Icon
      className={`${className} ${TONE[info.family] ?? "text-muted"}`}
      strokeWidth={1.75}
      role="img"
      aria-label={label ?? info.label}
    />
  );
}
