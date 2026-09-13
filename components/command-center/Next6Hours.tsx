import { DashboardCard } from "@/components/ui/primitives";
import { WeatherGlyph } from "@/components/weather/WeatherGlyph";
import { compass, formatHour } from "@/lib/format";
import type { HourPoint } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";
import { StateBlock } from "@/components/ui/primitives";
import type { WeatherData } from "@/lib/weather/types";

/**
 * The next six hours as a timeline.
 *
 * The design job here is making the hour where something changes obvious
 * without reading the numbers. Two devices do that: a column whose rain
 * probability crosses into "likely" is tinted and its figure brightened, and
 * the temperature row carries a marker at the hour of the largest swing. Every
 * value is still printed, so the emphasis guides rather than replaces reading.
 */

/** Rain probability at which a column is worth flagging. */
const RAIN_FLAG = 50;

export function Next6Hours({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="Next 6 Hours" status={weather.status}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Forecast"
        />
      </DashboardCard>
    );
  }

  const hours = data.hourly.slice(0, 7);
  if (hours.length < 2) {
    return (
      <DashboardCard title="Next 6 Hours" status={weather.status}>
        <StateBlock state="unavailable" label="Forecast" message="Not enough forecast hours available." />
      </DashboardCard>
    );
  }

  const biggestSwing = largestSwingIndex(hours);

  return (
    <DashboardCard
      title="Next 6 Hours"
      subtitle={summaryLine(hours)}
      status={weather.status}
      sources={weather.sources}
    >
      <div className="strip scroll-none -mx-1">
        {hours.map((hour, index) => {
          const wet = (hour.precipProbability ?? 0) >= RAIN_FLAG;
          const isNow = index === 0;

          return (
            <div
              key={hour.time}
              className={`mx-1 w-[4.6rem] border px-2 py-2 text-center ${
                wet
                  ? "border-series-rain/40 bg-series-rain/10"
                  : "hairline border-line bg-ink/30"
              } ${isNow ? "ring-1 ring-line-strong" : ""}`}
            >
              <div className="micro">{isNow ? "NOW" : formatHour(hour.time)}</div>

              <div className="tnum mt-2 font-mono text-lg leading-none text-fg">
                {Math.round(hour.temperature)}°
              </div>

              {index === biggestSwing ? (
                <div className="mt-0.5 text-[9px] tracking-wider text-level-moderate">
                  SWING
                </div>
              ) : (
                <div className="mt-0.5 h-[11px]" aria-hidden="true" />
              )}

              <div className="mt-1.5 flex justify-center">
                <WeatherGlyph code={hour.conditionCode} isDay={hour.isDay} />
              </div>

              <div
                className={`tnum mt-1.5 font-mono text-[12px] ${
                  wet ? "text-series-rain" : "text-faint"
                }`}
              >
                {hour.precipProbability === null ? "—" : `${Math.round(hour.precipProbability)}%`}
              </div>

              <div className="tnum mt-1 font-mono text-[10px] text-faint">
                {hour.windSpeed === null ? "—" : `${Math.round(hour.windSpeed)} ${compass(hour.windDirection)}`}
              </div>

              <div className="tnum mt-0.5 font-mono text-[10px] text-faint">
                {hour.pressureInHg === null ? "—" : hour.pressureInHg.toFixed(2)}
              </div>

              <div className="tnum mt-0.5 font-mono text-[10px] text-faint">
                {hour.cloudCover === null ? "—" : `${Math.round(hour.cloudCover)}% cld`}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-faint">
        Rows: temperature · conditions · rain probability · wind · pressure · cloud cover
      </p>
    </DashboardCard>
  );
}

/** The hour with the largest temperature step, which is what people plan around. */
function largestSwingIndex(hours: HourPoint[]): number {
  let index = -1;
  let largest = 0;
  for (let position = 1; position < hours.length; position += 1) {
    const delta = Math.abs(hours[position].temperature - hours[position - 1].temperature);
    if (delta > largest) {
      largest = delta;
      index = position;
    }
  }
  // Below three degrees an hour there is no swing worth marking.
  return largest >= 3 ? index : -1;
}

function summaryLine(hours: HourPoint[]): string {
  const temps = hours.map((hour) => hour.temperature);
  const peakRain = Math.max(...hours.map((hour) => hour.precipProbability ?? 0));
  const range = `${Math.round(Math.min(...temps))}° to ${Math.round(Math.max(...temps))}°`;
  return peakRain >= 20
    ? `${range}, rain probability peaking at ${Math.round(peakRain)}%`
    : `${range}, no significant precipitation expected`;
}
