import type { Alert, AlertSeverity, ModuleSnapshot } from "@/types";

/**
 * The Alert Center's ordering rules.
 *
 * The dashboard's job is to surface what needs action, which means not showing
 * everything at equal weight. Alerts are ranked by the priority class they
 * were raised with — immediate safety, then commute disruption, then severe
 * weather, then significant weather changes, then public safety, then general
 * information — and within a class by severity and recency.
 *
 * Priority is set by whichever module raised the alert, because that module
 * knows what its alert means. This file only sorts, dedupes and counts.
 */

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  important: 1,
  advisory: 2,
  info: 3,
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Immediate safety",
  2: "Commute disruption",
  3: "Severe weather",
  4: "Weather change",
  5: "Public safety",
  6: "Information",
};

/** Collects alerts from any set of module snapshots and ranks them. */
export function collectAlerts(snapshots: ModuleSnapshot<unknown>[]): Alert[] {
  const all = snapshots.flatMap((snapshot) => snapshot.alerts);
  return rankAlerts(all);
}

export function rankAlerts(alerts: Alert[]): Alert[] {
  const byId = new Map<string, Alert>();
  for (const alert of alerts) {
    const existing = byId.get(alert.id);
    // The same alert can arrive from two modules; keep the louder framing.
    if (!existing || SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[existing.severity]) {
      byId.set(alert.id, alert);
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    return (b.issuedAt ?? 0) - (a.issuedAt ?? 0);
  });
}

/** Alerts that take over the top of the dashboard. */
export function overridingAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.overridesLayout || alert.severity === "critical");
}

export function countBySeverity(alerts: Alert[]): Record<AlertSeverity, number> {
  const counts: Record<AlertSeverity, number> = {
    critical: 0,
    important: 0,
    advisory: 0,
    info: 0,
  };
  for (const alert of alerts) counts[alert.severity] += 1;
  return counts;
}

/** Drops alerts whose stated expiry has passed. */
export function activeAlerts(alerts: Alert[], now = Date.now()): Alert[] {
  return alerts.filter((alert) => !alert.expiresAt || alert.expiresAt > now);
}
