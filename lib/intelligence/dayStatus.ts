import { condition } from "../weather/conditions";
import type { AirQualityData, WeatherAlert, WeatherData } from "../weather/types";
import type { CommuteData } from "../routing/types";
import type { RoadsData } from "../traffic/types";
import type { PublicSafetyData } from "../sources/types";
import type { DayStatus, ModuleSnapshot, StatusCategory, StatusLevel } from "@/types";

/**
 * The day score.
 *
 * A deliberately simple, fully transparent points model: each category
 * contributes points for specific, named conditions, the points are summed,
 * and the sum picks a band. Every category reports the points it contributed,
 * and the UI shows them — so the score can always be taken apart into "why".
 *
 * It is a convenience indicator for glancing at, not a scientific index, and
 * the UI says so. Its one real design rule is that a category which could not
 * be checked scores zero points and reports `unknown`, so a failed feed never
 * masquerades as a quiet one.
 */

const BANDS: { max: number; level: StatusLevel; label: string }[] = [
  { max: 10, level: "good", label: "CLEAR" },
  { max: 30, level: "moderate", label: "MODERATE" },
  { max: 55, level: "poor", label: "ELEVATED" },
  { max: Number.POSITIVE_INFINITY, level: "severe", label: "SEVERE" },
];

export type DayStatusInput = {
  weather: ModuleSnapshot<WeatherData>;
  weatherAlerts: ModuleSnapshot<WeatherAlert[]>;
  airQuality: ModuleSnapshot<AirQualityData>;
  commute: ModuleSnapshot<CommuteData>;
  roads: ModuleSnapshot<RoadsData>;
  publicSafety: ModuleSnapshot<PublicSafetyData>;
};

export function computeDayStatus(input: DayStatusInput): DayStatus {
  const categories = [
    weatherCategory(input.weather, input.airQuality),
    severeCategory(input.weatherAlerts),
    commuteCategory(input.commute),
    roadsCategory(input.roads),
    publicSafetyCategory(input.publicSafety),
  ];

  const score = Math.min(
    100,
    categories.reduce((sum, category) => sum + category.points, 0),
  );
  const band = BANDS.find((candidate) => score < candidate.max) ?? BANDS[BANDS.length - 1];

  return {
    level: band.level,
    label: band.label,
    score,
    headline: headlineFor(categories, band.level),
    categories,
  };
}

function weatherCategory(
  weather: ModuleSnapshot<WeatherData>,
  airQuality: ModuleSnapshot<AirQualityData>,
): StatusCategory {
  if (!weather.data) {
    return {
      key: "weather",
      label: "Weather",
      level: "unknown",
      detail: "Forecast unavailable",
      points: 0,
    };
  }

  const { current, hourly } = weather.data;
  const next12 = hourly.filter(
    (hour) => hour.time <= current.observedAt + 12 * 3_600_000,
  );

  const peakPrecip = Math.max(
    0,
    ...next12.map((hour) => hour.precipProbability ?? 0),
  );
  const peakGust = Math.max(0, ...next12.map((hour) => hour.windGust ?? 0));
  const lowVisibility = Math.min(
    99,
    ...next12.map((hour) => hour.visibilityMiles ?? 99),
  );

  let points = 0;
  const reasons: string[] = [];

  if (peakPrecip >= 70) {
    points += 12;
    reasons.push(`rain likely (${Math.round(peakPrecip)}%)`);
  } else if (peakPrecip >= 50) {
    points += 8;
    reasons.push(`rain possible (${Math.round(peakPrecip)}%)`);
  } else if (peakPrecip >= 30) {
    points += 4;
    reasons.push(`scattered showers possible (${Math.round(peakPrecip)}%)`);
  }

  if (peakGust >= 40) {
    points += 10;
    reasons.push(`gusts to ${Math.round(peakGust)} MPH`);
  } else if (peakGust >= 30) {
    points += 6;
    reasons.push(`gusts to ${Math.round(peakGust)} MPH`);
  }

  if (current.high >= 95 || current.low <= 20) {
    points += 10;
    reasons.push(current.high >= 95 ? "extreme heat" : "hard freeze");
  }

  if (lowVisibility < 3) {
    points += 8;
    reasons.push(`visibility down to ${lowVisibility.toFixed(1)} mi`);
  }

  // Air quality folds in here rather than standing as its own row, so the
  // status table stays the five categories the dashboard promises.
  const aqi = airQuality.data?.aqi ?? null;
  if (aqi !== null && aqi > 150) {
    points += 10;
    reasons.push(`AQI ${Math.round(aqi)}`);
  } else if (aqi !== null && aqi > 100) {
    points += 5;
    reasons.push(`AQI ${Math.round(aqi)}`);
  }

  return {
    key: "weather",
    label: "Weather",
    level: points >= 18 ? "poor" : points >= 6 ? "moderate" : "good",
    detail: reasons.length
      ? capitalise(reasons.join(", "))
      : `${condition(current.conditionCode).label}, nothing notable in the next 12 hours`,
    points,
  };
}

function severeCategory(alerts: ModuleSnapshot<WeatherAlert[]>): StatusCategory {
  if (!alerts.data) {
    return {
      key: "severe",
      label: "Severe Weather",
      level: "unknown",
      detail: "Alert feed unavailable — status unknown",
      points: 0,
    };
  }

  if (!alerts.data.length) {
    return {
      key: "severe",
      label: "Severe Weather",
      level: "good",
      detail: "No active NWS alerts",
      points: 0,
    };
  }

  const critical = alerts.data.filter((alert) => alert.severity === "critical");
  const important = alerts.data.filter((alert) => alert.severity === "important");

  const points = critical.length ? 40 : important.length ? 20 : 8;

  return {
    key: "severe",
    label: "Severe Weather",
    level: critical.length ? "severe" : important.length ? "poor" : "moderate",
    detail: alerts.data.map((alert) => alert.event).slice(0, 3).join(", "),
    points,
  };
}

function commuteCategory(commute: ModuleSnapshot<CommuteData>): StatusCategory {
  const data = commute.data;

  if (!data) {
    return {
      key: "commute",
      label: "Commute",
      level: "unknown",
      detail:
        commute.status.state === "locked"
          ? "Locked — enter the passcode to include the commute"
          : "Traffic data unavailable",
      points: 0,
    };
  }

  if (data.delayMinutes === null) {
    return {
      key: "commute",
      label: "Commute",
      level: "unknown",
      detail: "Free-flow estimate only — no live traffic provider configured",
      points: 0,
    };
  }

  // Points follow the module's own status bands rather than a second set of
  // thresholds; otherwise a commute badged MODERATE could contribute nothing
  // to the score, and the two readings would visibly disagree on screen.
  const delay = data.delayMinutes;
  const points =
    data.level === "severe" ? 25 : data.level === "poor" ? 15 : data.level === "moderate" ? 6 : 0;

  return {
    key: "commute",
    label: "Commute",
    level: data.level,
    detail:
      delay >= 1
        ? `${Math.round(delay)} min slower than normal`
        : "Running at normal speed",
    points,
  };
}

function roadsCategory(roads: ModuleSnapshot<RoadsData>): StatusCategory {
  const data = roads.data;

  if (!data || !data.configured) {
    return {
      key: "roads",
      label: "Road Conditions",
      level: "unknown",
      detail:
        roads.status.state === "locked"
          ? "Locked — enter the passcode to include road conditions"
          : "No road-condition feed configured",
      points: 0,
    };
  }

  const closures = data.closures.filter((closure) => closure.type === "closure");
  const others = data.closures.length - closures.length;

  if (closures.length) {
    return {
      key: "roads",
      label: "Road Conditions",
      level: "poor",
      detail: `${closures.length} reported ${closures.length === 1 ? "closure" : "closures"}`,
      points: 15,
    };
  }

  if (others > 0) {
    return {
      key: "roads",
      label: "Road Conditions",
      level: "moderate",
      detail: `${others} reported ${others === 1 ? "restriction" : "restrictions"}`,
      points: 6,
    };
  }

  return {
    key: "roads",
    label: "Road Conditions",
    level: "good",
    detail: `No issues reported by ${data.agency}`,
    points: 0,
  };
}

/**
 * Public safety contributes a small number of points.
 *
 * A publicly announced checkpoint is information, not a hazard, so it nudges
 * the score rather than driving it — and an unreachable source reports unknown
 * rather than clean, which is the whole reason this category is scored at all.
 */
function publicSafetyCategory(
  publicSafety: ModuleSnapshot<PublicSafetyData>,
): StatusCategory {
  const data = publicSafety.data;

  if (!data || (data.sourcesChecked > 0 && data.sourcesFailed === data.sourcesChecked)) {
    return {
      key: "public-safety",
      label: "Public Safety",
      level: "unknown",
      detail: "Monitored sources could not be checked",
      points: 0,
    };
  }

  if (data.checkpoints.length) {
    return {
      key: "public-safety",
      label: "Public Safety",
      level: "moderate",
      detail: `${data.checkpoints.length} publicly announced ${
        data.checkpoints.length === 1 ? "checkpoint" : "checkpoints"
      }`,
      points: 5,
    };
  }

  return {
    key: "public-safety",
    label: "Public Safety",
    level: data.sourcesFailed > 0 ? "unknown" : "good",
    detail:
      data.sourcesFailed > 0
        ? `${data.sourcesFailed} of ${data.sourcesChecked} sources unreachable`
        : "Nothing announced in monitored sources",
    points: 0,
  };
}

function headlineFor(categories: StatusCategory[], level: StatusLevel): string {
  const drivers = categories
    .filter((category) => category.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2);

  if (!drivers.length) {
    const unknowns = categories.filter((category) => category.level === "unknown");
    if (unknowns.length) {
      return `Nothing notable in what could be checked. ${unknowns.length} ${
        unknowns.length === 1 ? "category" : "categories"
      } could not be checked.`;
    }
    return "Nothing notable across weather, commute or public safety.";
  }

  const text = drivers.map((driver) => driver.detail.toLowerCase()).join(" + ");
  return level === "severe" ? `${capitalise(text)} — act on this first.` : capitalise(text);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
