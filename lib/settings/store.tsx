"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultSettings, type Settings } from "../config";
import { settingsToParams } from "./params";

/**
 * Settings live in the browser.
 *
 * There is no account and no database in this app, by design, so preferences
 * are held in localStorage and the handful the server needs to compute a
 * departure time travel as query parameters on each request. That keeps the
 * deployment stateless and means nothing about the user is stored anywhere but
 * on their own device.
 *
 * Reads are guarded: a first render on the server has no localStorage, and a
 * stored blob from an older version of the app may be missing fields, so
 * everything is merged over the defaults rather than trusted wholesale.
 */

const STORAGE_KEY = "command-center.settings.v1";

type SettingsContextValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  /** Query string carrying the server-relevant settings. */
  query: string;
  /** False until localStorage has been read, so the UI can avoid a flash. */
  ready: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(load());
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = defaultSettings();
    save(next);
    setSettings(next);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update,
      reset,
      query: settingsToParams(settings).toString(),
      ready,
    }),
    [settings, update, reset, ready],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside a SettingsProvider");
  }
  return context;
}

function load(): Settings {
  const base = defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;

    const stored = JSON.parse(raw) as Partial<Settings>;
    return {
      ...base,
      ...stored,
      // Nested objects are merged rather than replaced, so a settings blob
      // written before a unit was added does not drop the new default.
      units: { ...base.units, ...(stored.units ?? {}) },
      notifications: { ...base.notifications, ...(stored.notifications ?? {}) },
      commuteDays: Array.isArray(stored.commuteDays) ? stored.commuteDays : base.commuteDays,
      disabledSources: Array.isArray(stored.disabledSources)
        ? stored.disabledSources
        : base.disabledSources,
    };
  } catch {
    // Private browsing, a full quota or a corrupt blob: fall back to defaults
    // rather than breaking the dashboard over a preference.
    return base;
  }
}

function save(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do: the app works fine without persistence.
  }
}
