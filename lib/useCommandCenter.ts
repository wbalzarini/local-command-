"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inCommuteWindow } from "./routing/departure";
import { useSettings } from "./settings/store";
import { deliver, primeSeen } from "./notifications/client";
import type { CommandCenterData } from "./intelligence/commandCenter";
import type { DashboardSnapshot } from "./intelligence/snapshot";

/**
 * The Today page's data loop.
 *
 * The first render is server-rendered with real data, so this hook starts from
 * a complete dashboard and only refreshes it — there is no loading state on
 * first paint, which is the single biggest thing that makes the dashboard feel
 * instant.
 *
 * Three behaviours worth noting:
 *
 *  - Polling tightens inside the commute window and relaxes outside it, which
 *    matches where the value is: traffic at 07:15 changes minute to minute,
 *    and nothing on this page changes much at 22:00. Provider call rates are
 *    bounded server-side regardless, so a fast poll cannot run up a bill.
 *  - A hidden tab does not poll at all, and refreshes once on becoming
 *    visible. A dashboard left open on a second monitor all weekend should not
 *    be making requests all weekend.
 *  - The snapshot from the previous visit is kept in localStorage and sent
 *    with each refresh, which is what makes "what changed" mean "since you
 *    last looked" rather than "since some other request".
 */

const SNAPSHOT_KEY = "command-center.snapshot.v1";

/** Poll intervals in milliseconds. */
const INTERVAL = {
  commuteWindow: 60_000,
  normal: 180_000,
} as const;

export type CommandCenterState = {
  data: CommandCenterData;
  refreshing: boolean;
  /** Set when the last refresh failed. The previous data stays on screen. */
  error: string | null;
  refresh: () => void;
  /** Last time a refresh succeeded, for the manual-refresh affordance. */
  lastRefreshedAt: number;
};

export function useCommandCenter(initial: CommandCenterData): CommandCenterState {
  const { settings, query } = useSettings();
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(initial.generatedAt);

  // The alerts present on first load are not news — the user is looking at
  // them — so they are marked seen rather than announced.
  const primed = useRef(false);
  useEffect(() => {
    if (primed.current) return;
    primed.current = true;
    primeSeen(initial.alerts);
    storeSnapshot(initial.snapshot);
  }, [initial]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/command-center?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: readSnapshot() }),
      });

      if (!response.ok) throw new Error(`Dashboard refresh failed (${response.status})`);

      const body = (await response.json()) as CommandCenterData;
      setData(body);
      setError(null);
      setLastRefreshedAt(Date.now());
      storeSnapshot(body.snapshot);
      deliver(body.alerts, settings);
    } catch (cause) {
      // The previous dashboard stays on screen; the failure is reported rather
      // than blanking a page full of still-useful data.
      setError(cause instanceof Error ? cause.message : "Dashboard refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [query, settings]);

  useEffect(() => {
    const period = inCommuteWindow(settings) ? INTERVAL.commuteWindow : INTERVAL.normal;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, period);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Catch up if the tab was hidden for longer than a poll period.
      if (Date.now() - lastRefreshedAt > period) void refresh();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, settings, lastRefreshedAt]);

  return {
    data,
    refreshing,
    error,
    refresh: () => void refresh(),
    lastRefreshedAt,
  };
}

function readSnapshot(): DashboardSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as DashboardSnapshot) : null;
  } catch {
    return null;
  }
}

function storeSnapshot(snapshot: DashboardSnapshot): void {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Without storage, "what changed" falls back to the server's own previous
    // assembly, which is a slightly worse comparison but still a real one.
  }
}
