import { rng, seedFrom } from "../rng";
import { TIME_ZONE } from "../format";
import { condition } from "./conditions";
import { analysePressure } from "./pressure";
import { analyseTrends } from "./trends";
import type {
  AirQualityData,
  CurrentConditions,
  DayPoint,
  HourPoint,
  WeatherData,
} from "./types";
import type { SourceRef } from "@/types";

/**
 * Sample weather for developing the UI before any provider is reachable.
 *
 * Deterministic: seeded from the calendar date, so the dashboard looks the
 * same on every reload of the same day and a screenshot is reproducible. The
 * shapes are physically plausible — a diurnal temperature curve, pressure
 * drifting over days rather than jumping hour to hour, rain chances that build
 * through an afternoon — because sample data that behaves oddly sends you
 * hunting for bugs in the charts instead of the generator.
 *
 * Every path that returns this data reports `state: "demo"`, and the UI
 * renders a DEMO DATA badge from that. It is never presented as observed.
 */

export const DEMO_SOURCE: SourceRef = {
  name: "Simulated sample data",
  kind: "demo",
};

const HOUR = 3_600_000;

export function demoWeather(now = Date.now()): WeatherData {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const random = rng(seedFrom("weather", dateKey.format(new Date(now))));

  // Anchor the series to the top of the current hour so the "now" marker lands
  // on a sample rather than between two.
  const currentHourStart = Math.floor(now / HOUR) * HOUR;
  const startHour = currentHourStart - 48 * HOUR;
  const totalHours = 48 + 11 * 24;

  // A falling barometer, which is the more interesting state to design
  // against: it exercises the trend arrows, the interpretation copy and the
  // "what changed" pressure row all at once.
  //
  // The amplitude matters. Real synoptic pressure swings run a few tenths of an
  // inch over a couple of days, and an earlier version of this generator drifted
  // by a hundredth — which classified as "steady" forever and left the whole
  // pressure module looking broken in sample mode.
  const pressureBase = 30.22;
  /** inHg per day of synoptic drift. */
  const pressureDrift = -0.13;
  /** Amplitude and period of the shorter-term wave riding on the drift. */
  const pressureWave = { amplitude: 0.06, periodHours: 34 };
  const seasonalBase = 71;

  const hours: HourPoint[] = [];
  for (let index = 0; index < totalHours; index += 1) {
    const time = startHour + index * HOUR;
    const hourOfDay = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false })
        .format(new Date(time)),
    ) % 24;
    const dayIndex = Math.floor((time - startHour) / 86_400_000);

    // Diurnal curve: coldest around 05:00, warmest around 16:00.
    const diurnal = -Math.cos(((hourOfDay - 5) / 24) * 2 * Math.PI) * 9;
    const dayOffset = (random.next() - 0.5) * 4 + dayIndex * -0.25;
    const temperature = seasonalBase + diurnal + dayOffset;

    const pressureInHg =
      pressureBase +
      pressureDrift * ((time - startHour) / (24 * HOUR)) +
      Math.sin((index / pressureWave.periodHours) * 2 * Math.PI) * pressureWave.amplitude;

    // Rain builds through the afternoon on the days the generator marks wet.
    const wetDay = (dayIndex + 2) % 3 === 0;
    const afternoon = hourOfDay >= 12 && hourOfDay <= 20;
    const precipProbability = wetDay
      ? Math.min(85, Math.max(5, (hourOfDay - 8) * 7 + (afternoon ? 15 : 0)))
      : Math.max(0, 18 - Math.abs(hourOfDay - 15) * 2);

    const cloudCover = Math.min(100, Math.max(8, precipProbability * 1.1 + 25 + (random.next() - 0.5) * 20));
    const conditionCode = pickCode(precipProbability, cloudCover, wetDay && afternoon);
    const isDay = hourOfDay >= 7 && hourOfDay < 19;
    const humidity = Math.min(97, Math.max(38, 62 + precipProbability * 0.3 - diurnal * 1.2));

    hours.push({
      time,
      temperature: round(temperature, 1),
      feelsLike: round(temperature + (humidity > 70 && temperature > 75 ? 3 : -1), 1),
      humidity: Math.round(humidity),
      dewPoint: round(temperature - (100 - humidity) / 5, 1),
      precipProbability: Math.round(precipProbability),
      precipitation: precipProbability > 55 ? round(random.range(0.01, 0.12), 2) : 0,
      conditionCode,
      pressureInHg: round(pressureInHg, 3),
      cloudCover: Math.round(cloudCover),
      windSpeed: round(6 + Math.abs(diurnal) * 0.4 + random.range(0, 4), 1),
      windGust: round(12 + Math.abs(diurnal) * 0.7 + random.range(0, 7), 1),
      windDirection: Math.round(240 + Math.sin(index / 30) * 60),
      visibilityMiles: precipProbability > 60 ? round(random.range(3, 7), 1) : round(random.range(8.5, 10), 1),
      uvIndex: isDay ? round(Math.max(0, 6 - Math.abs(hourOfDay - 13) * 0.9), 1) : 0,
      isDay,
    });
  }

  const currentIndex = hours.findIndex((hour) => hour.time === currentHourStart);
  const index = currentIndex >= 0 ? currentIndex : 48;
  const currentHour = hours[index];
  const recentHourly = hours.slice(0, index);
  const forwardHourly = hours.slice(index);

  const days = buildDemoDays(hours, dateKey);
  const today = days.find((day) => day.date === dateKey.format(new Date(now))) ?? days[0];

  const current: CurrentConditions = {
    observedAt: now,
    temperature: currentHour.temperature,
    feelsLike: currentHour.feelsLike ?? currentHour.temperature,
    conditionCode: currentHour.conditionCode,
    condition: condition(currentHour.conditionCode).label,
    isDay: currentHour.isDay,
    high: today.high,
    low: today.low,
    humidity: currentHour.humidity ?? 60,
    dewPoint: currentHour.dewPoint,
    windSpeed: currentHour.windSpeed ?? 7,
    windDirection: currentHour.windDirection ?? 270,
    windGust: currentHour.windGust,
    visibilityMiles: currentHour.visibilityMiles,
    precipitation: currentHour.precipitation ?? 0,
    precipProbability: currentHour.precipProbability,
    pressureInHg: currentHour.pressureInHg ?? 30.1,
    cloudCover: currentHour.cloudCover ?? 40,
    uvIndex: currentHour.uvIndex,
    sunrise: today.sunrise,
    sunset: today.sunset,
  };

  const pressureHistory = recentHourly
    .filter((hour) => hour.pressureInHg !== null)
    .map((hour) => ({ time: hour.time, pressureInHg: hour.pressureInHg as number }))
    .concat({ time: now, pressureInHg: current.pressureInHg });

  const yesterdayIndex = days.findIndex((day) => day.date === today.date) - 1;

  return {
    current,
    hourly: forwardHourly,
    recentHourly,
    daily: days.filter((day) => day.time >= today.time).slice(0, 11),
    pressure: analysePressure(pressureHistory, current.pressureInHg),
    trends: analyseTrends(recentHourly, current, forwardHourly),
    daylight: {
      sunrise: today.sunrise,
      sunset: today.sunset,
      daylightSeconds: Math.round((today.sunset - today.sunrise) / 1000),
      remainingSeconds: Math.max(0, Math.round((today.sunset - now) / 1000)),
      goldenHourStart: today.sunset > now ? today.sunset - HOUR : null,
      goldenHourEnd: today.sunset > now ? today.sunset : null,
    },
    yesterday:
      yesterdayIndex >= 0
        ? {
            high: days[yesterdayIndex].high,
            low: days[yesterdayIndex].low,
            precipitation: days[yesterdayIndex].precipitation,
          }
        : null,
  };
}

function buildDemoDays(hours: HourPoint[], dateKey: Intl.DateTimeFormat): DayPoint[] {
  const byDate = new Map<string, HourPoint[]>();
  for (const hour of hours) {
    const key = dateKey.format(new Date(hour.time));
    const bucket = byDate.get(key);
    if (bucket) bucket.push(hour);
    else byDate.set(key, [hour]);
  }

  const days: DayPoint[] = [];
  for (const [date, bucket] of byDate) {
    const temperatures = bucket.map((hour) => hour.temperature);
    const dayStart = new Date(`${date}T00:00:00`).getTime();
    const worst = bucket.reduce(
      (best, hour) => ((hour.precipProbability ?? 0) > (best.precipProbability ?? 0) ? hour : best),
      bucket[0],
    );

    days.push({
      date,
      time: Number.isNaN(dayStart) ? bucket[0].time : dayStart,
      conditionCode: worst.conditionCode,
      condition: condition(worst.conditionCode).label,
      high: round(Math.max(...temperatures), 0),
      low: round(Math.min(...temperatures), 0),
      precipProbability: worst.precipProbability,
      precipitation: round(
        bucket.reduce((sum, hour) => sum + (hour.precipitation ?? 0), 0),
        2,
      ),
      windSpeed: round(Math.max(...bucket.map((hour) => hour.windSpeed ?? 0)), 1),
      windGust: round(Math.max(...bucket.map((hour) => hour.windGust ?? 0)), 1),
      windDirection: worst.windDirection,
      // Approximate mid-September daylight for south-eastern Pennsylvania.
      sunrise: (Number.isNaN(dayStart) ? bucket[0].time : dayStart) + 6.6 * HOUR,
      sunset: (Number.isNaN(dayStart) ? bucket[0].time : dayStart) + 19.3 * HOUR,
      daylightSeconds: Math.round(12.7 * 3600),
      uvIndexMax: round(Math.max(...bucket.map((hour) => hour.uvIndex ?? 0)), 1),
      pressureInHg: round(
        bucket.reduce((sum, hour) => sum + (hour.pressureInHg ?? 0), 0) / bucket.length,
        2,
      ),
    });
  }

  return days.sort((a, b) => a.time - b.time);
}

function pickCode(precipProbability: number, cloudCover: number, storm: boolean): number {
  if (storm && precipProbability > 70) return 95;
  if (precipProbability > 65) return 63;
  if (precipProbability > 45) return 61;
  if (precipProbability > 30) return 51;
  if (cloudCover > 80) return 3;
  if (cloudCover > 45) return 2;
  if (cloudCover > 20) return 1;
  return 0;
}

export function demoAirQuality(now = Date.now()): AirQualityData {
  const random = rng(seedFrom("air-quality", Math.floor(now / 86_400_000)));
  const aqi = Math.round(random.range(28, 62));
  const good = aqi <= 50;

  return {
    observedAt: now,
    aqi,
    category: good ? "good" : "moderate",
    label: good ? "GOOD" : "MODERATE",
    pm25: round(random.range(4, 14), 1),
    pm10: round(random.range(8, 22), 1),
    ozone: round(random.range(38, 74), 1),
    smokeIndex: round(random.range(0.03, 0.16), 2),
    pollen: null,
    summary: good
      ? `AQI ${aqi} — air quality is good.`
      : `AQI ${aqi} — acceptable, with a minor concern for unusually sensitive people.`,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
