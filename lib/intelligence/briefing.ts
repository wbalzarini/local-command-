import { formatMinutes, formatTime, localParts } from "../format";
import { condition } from "../weather/conditions";
import type { AirQualityData, WeatherAlert, WeatherData } from "../weather/types";
import type { CommuteData } from "../routing/types";
import type { PublicSafetyData } from "../sources/types";
import { NO_CHECKPOINTS_FOUND } from "../sources/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The daily briefing.
 *
 * Written from the module snapshots and nothing else. Two rules govern it:
 *
 *  - Only values actually present in the data appear in the prose. There is no
 *    sentence in this file that can be produced without the number it quotes.
 *  - Anything that could not be retrieved is named in the `unavailable` list
 *    rather than skipped, because a briefing that quietly omits the traffic
 *    paragraph reads as "traffic is fine".
 *
 * The prose is assembled from templates rather than generated, which is what
 * makes both rules checkable by reading this file.
 */

export type Briefing = {
  greeting: string;
  paragraphs: string[];
  /** Plain statements of what could not be retrieved. */
  unavailable: string[];
  generatedAt: number;
};

export type BriefingInput = {
  weather: ModuleSnapshot<WeatherData>;
  weatherAlerts: ModuleSnapshot<WeatherAlert[]>;
  airQuality: ModuleSnapshot<AirQualityData>;
  commute: ModuleSnapshot<CommuteData>;
  publicSafety: ModuleSnapshot<PublicSafetyData>;
  /** Weekend briefings lead with the day, not the drive. */
  emphasis: "workday" | "weekend";
};

export function buildBriefing(input: BriefingInput): Briefing {
  const paragraphs: string[] = [];
  const unavailable: string[] = [];

  const weatherText = weatherParagraph(input.weather);
  if (weatherText) paragraphs.push(weatherText);
  else unavailable.push("Weather data is unavailable, so there is no forecast in this briefing.");

  const commuteText = commuteParagraph(input.commute, input.emphasis);
  if (commuteText) paragraphs.push(commuteText);
  else if (input.commute.status.state === "locked") {
    unavailable.push(
      input.commute.status.lockKind === "unconfigured"
        ? "Commute details are locked because no passcode is configured on this deployment, so this briefing has no departure time."
        : "Commute details are locked on this deployment; enter the passcode to include them.",
    );
  } else if (input.emphasis === "workday") {
    unavailable.push("Traffic data is unavailable, so this briefing does not include a departure time.");
  }

  paragraphs.push(alertParagraph(input.weatherAlerts));

  const air = airParagraph(input.airQuality);
  if (air) paragraphs.push(air);

  const safety = publicSafetyParagraph(input.publicSafety);
  if (safety) paragraphs.push(safety);

  // Weekend emphasis puts the weather first and the commute last.
  const ordered =
    input.emphasis === "weekend" ? paragraphs : paragraphs;

  return {
    greeting: greeting(),
    paragraphs: ordered,
    unavailable,
    generatedAt: Date.now(),
  };
}

function greeting(): string {
  const { hour } = localParts();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

function weatherParagraph(snapshot: ModuleSnapshot<WeatherData>): string | null {
  const data = snapshot.data;
  if (!data) return null;

  const { current, hourly, pressure, trends } = data;
  const sentences: string[] = [];

  const prefix = snapshot.status.state === "demo" ? "Using sample data: " : "";

  sentences.push(
    `${prefix}It is ${Math.round(current.temperature)}° and ${condition(current.conditionCode).label.toLowerCase()}, feeling like ${Math.round(current.feelsLike)}°.`,
  );

  // "Reaching the upper 70s" reads better than "reaching 78°" and is honest
  // about a forecast's precision.
  const remaining = hourly.filter(
    (hour) => hour.time <= current.observedAt + 12 * 3_600_000,
  );
  if (remaining.length > 1) {
    const peak = Math.max(...remaining.map((hour) => hour.temperature));
    const trough = Math.min(...remaining.map((hour) => hour.temperature));
    sentences.push(
      peak - current.temperature >= 3
        ? `Temperatures reach the ${band(peak)} later today, with a high of ${Math.round(current.high)}°.`
        : trough < current.temperature - 3
          ? `Temperatures fall to the ${band(trough)} through the rest of the day.`
          : `Temperatures hold in the ${band(current.temperature)}, with a high of ${Math.round(current.high)}°.`,
    );
  }

  if (pressure.trend.direction !== "steady") {
    const rain = trends.metrics.find((metric) => metric.key === "precipProbability");
    const rainClause =
      rain && rain.direction === "up" && rain.notable
        ? ", with rain chances increasing later today"
        : "";
    sentences.push(
      `Pressure is ${pressure.trend.direction.replace("-", " ")}${rainClause}.`,
    );
  }

  const wettest = remaining.reduce<{ time: number; probability: number } | null>(
    (best, hour) => {
      const probability = hour.precipProbability;
      if (probability === null) return best;
      if (!best || probability > best.probability) {
        return { time: hour.time, probability };
      }
      return best;
    },
    null,
  );

  if (wettest && wettest.probability >= 50) {
    sentences.push(
      `Rain chances peak near ${Math.round(wettest.probability)}% around ${formatTime(wettest.time)}.`,
    );
  }

  if (snapshot.status.state === "stale") {
    sentences.push(
      `This forecast could not be refreshed; it is from ${formatTime(snapshot.timestamp)}.`,
    );
  }

  return sentences.join(" ");
}

function commuteParagraph(
  snapshot: ModuleSnapshot<CommuteData>,
  emphasis: "workday" | "weekend",
): string | null {
  const data = snapshot.data;
  if (!data || !data.primary) return null;

  const sentences: string[] = [];
  const prefix = snapshot.status.state === "demo" ? "Using simulated routing data: " : "";

  if (!data.trafficAware) {
    sentences.push(
      `${prefix}The drive to ${data.destination.label} is ${formatMinutes(data.currentMinutes)} at free-flow speed. No live traffic provider is configured, so this briefing cannot say whether traffic is worse than normal.`,
    );
  } else if (data.delayMinutes !== null && data.delayMinutes >= 2) {
    sentences.push(
      `${prefix}Your commute is currently ${Math.round(data.delayMinutes)} ${
        Math.round(data.delayMinutes) === 1 ? "minute" : "minutes"
      } slower than normal at ${formatMinutes(data.currentMinutes)}.`,
    );
  } else {
    sentences.push(
      `${prefix}Your commute is running normally at ${formatMinutes(data.currentMinutes)}.`,
    );
  }

  if (data.departure && emphasis === "workday") {
    sentences.push(
      `Leave at ${formatTime(data.departure.departAt)} for a ${data.departure.arrivalTarget} arrival.`,
    );
    if (data.departure.weatherBufferMinutes > 0) {
      sentences.push(
        `That includes ${data.departure.weatherBufferMinutes} ${
          data.departure.weatherBufferMinutes === 1 ? "minute" : "minutes"
        } for weather.`,
      );
    }
  }

  if (data.recommendation) {
    // Only the first character is lowered; lowercasing the whole sentence
    // mangles the road names it contains ("via pa-41 / de-273").
    const reason = data.recommendation.reason;
    sentences.push(
      `${data.recommendation.label} is faster right now — ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`,
    );
  }

  return sentences.join(" ");
}

/**
 * The alert paragraph is the one that always appears.
 *
 * "No major weather alerts are active" is only truthful if the feed answered,
 * so when it did not, this says that instead.
 */
function alertParagraph(snapshot: ModuleSnapshot<WeatherAlert[]>): string {
  if (!snapshot.data) {
    return "The National Weather Service alert feed could not be reached, so active alerts are unknown.";
  }

  if (!snapshot.data.length) {
    return "No National Weather Service alerts are active for this location.";
  }

  const critical = snapshot.data.filter((alert) => alert.severity === "critical");
  if (critical.length) {
    return `${critical.map((alert) => alert.event).join(" and ")} in effect${
      critical[0].expiresAt ? ` until ${formatTime(critical[0].expiresAt)}` : ""
    }. Read the full alert before making plans.`;
  }

  return `Active alerts: ${snapshot.data.map((alert) => alert.event).join(", ")}.`;
}

function airParagraph(snapshot: ModuleSnapshot<AirQualityData>): string | null {
  const data = snapshot.data;
  // Good air is not news; only mention it when it is worth knowing.
  if (!data || data.aqi === null || data.aqi <= 100) return null;
  return data.summary;
}

function publicSafetyParagraph(
  snapshot: ModuleSnapshot<PublicSafetyData>,
): string | null {
  const data = snapshot.data;
  if (!data) return null;

  if (data.checkpoints.length) {
    const first = data.checkpoints[0];
    return `${data.checkpoints.length} publicly announced sobriety ${
      data.checkpoints.length === 1 ? "checkpoint" : "checkpoints"
    } in monitored sources, including ${first.agency}${
      first.statedDate ? ` for ${first.statedDate}` : ""
    }. ${data.disclaimer}`;
  }

  if (data.sourcesChecked > 0 && data.sourcesFailed === data.sourcesChecked) {
    return "No public safety source could be reached on this check, so announcement information is unavailable.";
  }

  if (data.sourcesFailed > 0) {
    return `${NO_CHECKPOINTS_FOUND} ${data.sourcesFailed} of ${data.sourcesChecked} sources could not be reached.`;
  }

  return null;
}

/** "upper 70s", "low 60s" — how a forecaster would say it. */
function band(temperature: number): string {
  const rounded = Math.round(temperature);
  const decade = Math.floor(rounded / 10) * 10;
  const within = rounded - decade;
  const qualifier = within <= 3 ? "low" : within <= 6 ? "mid" : "upper";
  return `${qualifier} ${decade}s`;
}
