"use client";

import type { Alert, AlertSeverity } from "@/types";
import type { Settings } from "../config";

/**
 * Notification delivery.
 *
 * Browser notifications are the channel that works today: they need no server,
 * no push service and no subscription record, which suits an app with no
 * accounts. The rules below are the part worth getting right — what deserves
 * to interrupt someone — and they are deliberately separate from delivery so
 * that adding web push or email later is a new transport against the same
 * rules rather than a second copy of them.
 *
 * A notification fires once per alert id per session. The dashboard polls, so
 * without that the same thunderstorm warning would announce itself every
 * minute until it expired.
 */

const announced = new Set<string>();

/** Severities allowed to raise a notification at all. */
const NOTIFIABLE: AlertSeverity[] = ["critical", "important"];

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export function permissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Exclude<NotificationPermissionState, "unsupported">;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (permissionState() === "unsupported") return "unsupported";
  const result = await Notification.requestPermission();
  return result as Exclude<NotificationPermissionState, "unsupported">;
}

/**
 * Which alerts the user's settings allow through.
 *
 * Public safety is the exception to the severity filter: a newly found
 * checkpoint announcement is only ever an advisory, but it is also the one
 * thing in this app the user explicitly asked to be told about, so an
 * advisory in that category still notifies when the category is enabled.
 */
export function notifiable(alerts: Alert[], settings: Settings): Alert[] {
  return alerts.filter((alert) => {
    switch (alert.category) {
      case "severe-weather":
        return settings.notifications.severeWeather && NOTIFIABLE.includes(alert.severity);
      case "weather-change":
        return settings.notifications.weatherChange && NOTIFIABLE.includes(alert.severity);
      case "traffic-incident":
      case "traffic-delay":
        return settings.notifications.traffic;
      case "road-closure":
      case "road-condition":
        return settings.notifications.roads;
      case "public-safety":
        return settings.notifications.publicSafety;
      case "air-quality":
        return settings.notifications.weatherChange && NOTIFIABLE.includes(alert.severity);
      default:
        return false;
    }
  });
}

/** Fires notifications for alerts not yet announced this session. */
export function deliver(alerts: Alert[], settings: Settings): number {
  if (permissionState() !== "granted") return 0;

  let delivered = 0;
  for (const alert of notifiable(alerts, settings)) {
    if (announced.has(alert.id)) continue;
    announced.add(alert.id);

    try {
      new Notification(alert.title, {
        body: alert.body ?? alert.source.name,
        // The tag collapses repeats of the same alert into one entry in the
        // system tray if the browser shows it again.
        tag: alert.id,
        // Only immediate-safety alerts are allowed to persist on screen.
        requireInteraction: alert.priority === 1,
        silent: alert.severity !== "critical",
      });
      delivered += 1;
    } catch {
      // Some browsers throw when constructing notifications outside a service
      // worker; there is nothing useful to do but carry on.
    }
  }

  return delivered;
}

/**
 * Marks the alerts present on first load as already seen.
 *
 * Without this, opening the dashboard would fire a notification for every
 * alert currently active — which is the opposite of useful, since the user is
 * looking straight at them.
 */
export function primeSeen(alerts: Alert[]): void {
  for (const alert of alerts) announced.add(alert.id);
}
