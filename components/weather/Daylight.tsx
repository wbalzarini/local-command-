import { DashboardCard, Row, StateBlock } from "@/components/ui/primitives";
import { formatDuration, formatTime } from "@/lib/format";
import type { WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Daylight.
 *
 * Golden hour is only shown while the sun is still up, because "golden hour
 * was three hours ago" is not information anyone needs, and the provider gives
 * no reliable figure for tomorrow's until tomorrow.
 */
export function Daylight({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="Daylight" status={weather.status}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Daylight"
        />
      </DashboardCard>
    );
  }

  const { daylight } = data;
  const elapsed =
    daylight.daylightSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((daylight.daylightSeconds - daylight.remainingSeconds) /
              daylight.daylightSeconds) *
              100,
          ),
        )
      : 0;

  return (
    <DashboardCard title="Daylight" status={weather.status} sources={weather.sources}>
      <div className="relative h-1.5 bg-raised" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 bg-series-temp"
          style={{ width: `${elapsed}%` }}
        />
      </div>

      <dl className="mt-3">
        <Row label="Sunrise" value={formatTime(daylight.sunrise)} />
        <Row label="Sunset" value={formatTime(daylight.sunset)} />
        <Row label="Daylight" value={formatDuration(daylight.daylightSeconds / 60)} />
        <Row
          label="Remaining"
          value={
            daylight.remainingSeconds > 0
              ? formatDuration(daylight.remainingSeconds / 60)
              : "Sun has set"
          }
        />
        <Row
          label="Golden hour"
          value={
            daylight.goldenHourStart === null
              ? "—"
              : `${formatTime(daylight.goldenHourStart)} – ${formatTime(daylight.goldenHourEnd)}`
          }
        />
      </dl>
    </DashboardCard>
  );
}
