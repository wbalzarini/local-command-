"use client";

import { useEffect, useState } from "react";
import { Bell, Lock, MapPin, RotateCcw } from "lucide-react";
import { CommandHeader } from "@/components/command-center/CommandHeader";
import { DashboardCard, Segmented, Toggle } from "@/components/ui/primitives";
import { SourceStatusList } from "@/components/public-safety/SourceStatusList";
import { commuteWindowDescription } from "@/lib/routing/departure";
import { useSettings } from "@/lib/settings/store";
import { formatClock, parseClock } from "@/lib/format";
import {
  permissionState,
  requestPermission,
  type NotificationPermissionState,
} from "@/lib/notifications/client";
import type { SourceDefinition, SourceStatus } from "@/lib/sources/types";

/**
 * Settings.
 *
 * Everything here is stored in the browser. The locations are the exception —
 * they come from server environment variables, are shown read-only, and the
 * home address is deliberately not among them: the server holds it, the
 * browser is told only that a home location is configured.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type SettingsScreenProps = {
  /** Labels only. The home address never reaches the client. */
  locations: {
    homeLabel: string;
    homeConfigured: boolean;
    workLabel: string;
    workAddress?: string;
  };
  sources: SourceDefinition[];
  sourceStatuses: SourceStatus[];
  gateEnabled: boolean;
  authorized: boolean;
  /** Which routing and road providers this deployment has keys for. */
  providers: { traffic: string; roads: string; weather: string; radar: string };
};

export function SettingsScreen({
  locations,
  sources,
  sourceStatuses,
  gateEnabled,
  authorized,
  providers,
}: SettingsScreenProps) {
  const { settings, update, reset } = useSettings();
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [arrivalDraft, setArrivalDraft] = useState(settings.arrivalTime);

  useEffect(() => setPermission(permissionState()), []);
  useEffect(() => setArrivalDraft(settings.arrivalTime), [settings.arrivalTime]);

  const disabled = settings.disabledSources ?? [];

  return (
    <>
      <CommandHeader location="Settings" liveState="live" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <DashboardCard
          title="Locations"
          subtitle="Configured on the server, in environment variables"
        >
          <dl className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="micro">Home</dt>
                <dd className="mt-0.5 text-[13px] text-fg">{locations.homeLabel}</dd>
                <dd className="mt-0.5 text-[11px] leading-snug text-faint">
                  {locations.homeConfigured
                    ? "Exact coordinates are held server-side and are never sent to the browser or to a geocoder."
                    : "No HOME_LAT/HOME_LON set, so the borough centroid is used. That is accurate enough for weather and keeps the exact address out of the app entirely."}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="micro">Work</dt>
                <dd className="mt-0.5 text-[13px] text-fg">{locations.workLabel}</dd>
                {locations.workAddress ? (
                  <dd className="mt-0.5 text-[11px] text-muted">{locations.workAddress}</dd>
                ) : null}
                <dd className="mt-0.5 text-[11px] leading-snug text-faint">
                  Verified by geocoding this address; the configured coordinates
                  are the fallback when the geocoder cannot be reached.
                </dd>
              </div>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard title="Commute" subtitle={commuteWindowDescription(settings)}>
          <label className="block">
            <span className="micro">Desired arrival time</span>
            <input
              type="time"
              value={arrivalDraft}
              onChange={(event) => {
                setArrivalDraft(event.target.value);
                if (parseClock(event.target.value) !== null) {
                  update({ arrivalTime: event.target.value });
                }
              }}
              className="tnum mt-1 block border hairline border-line bg-ink px-2 py-1.5 font-mono text-[13px] text-fg"
            />
            <span className="mt-1 block text-[10px] text-faint">
              Departure is calculated backwards from {formatClock(parseClock(settings.arrivalTime) ?? 480)}.
            </span>
          </label>

          <div className="mt-3">
            <span className="micro">Commute days</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {DAYS.map((day, index) => {
                const active = settings.commuteDays.includes(index);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      update({
                        commuteDays: active
                          ? settings.commuteDays.filter((value) => value !== index)
                          : [...settings.commuteDays, index].sort(),
                      })
                    }
                    className={`border px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${
                      active
                        ? "border-line-strong bg-raised text-fg"
                        : "hairline border-line text-faint"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-[10px] text-faint">
              Also decides which days get the workday layout when emphasis is automatic.
            </span>
          </div>

          <NumberField
            label="Traffic alert threshold"
            hint="Raise a traffic alert once the delay reaches this many minutes."
            value={settings.trafficThresholdMinutes}
            min={1}
            max={60}
            onChange={(value) => update({ trafficThresholdMinutes: value })}
          />

          <NumberField
            label="Weather buffer per risk factor"
            hint="Minutes added to the departure time for each weather risk factor, capped at 15."
            value={settings.weatherBufferMinutes}
            min={0}
            max={15}
            onChange={(value) => update({ weatherBufferMinutes: value })}
          />

          <NumberField
            label="Alternate route threshold"
            hint="An alternate is only recommended once it saves at least this many minutes."
            value={settings.alternateThresholdMinutes}
            min={1}
            max={30}
            onChange={(value) => update({ alternateThresholdMinutes: value })}
          />
        </DashboardCard>

        <DashboardCard title="Units">
          <div className="space-y-3">
            <UnitRow label="Temperature">
              <Segmented
                label="Temperature unit"
                value={settings.units.temperature}
                onChange={(value) => update({ units: { ...settings.units, temperature: value } })}
                options={[
                  { value: "F", label: "°F" },
                  { value: "C", label: "°C" },
                ]}
              />
            </UnitRow>

            <UnitRow label="Wind">
              <Segmented
                label="Wind unit"
                value={settings.units.wind}
                onChange={(value) => update({ units: { ...settings.units, wind: value } })}
                options={[
                  { value: "mph", label: "MPH" },
                  { value: "kph", label: "KPH" },
                  { value: "kn", label: "KN" },
                ]}
              />
            </UnitRow>

            <UnitRow label="Pressure">
              <Segmented
                label="Pressure unit"
                value={settings.units.pressure}
                onChange={(value) => update({ units: { ...settings.units, pressure: value } })}
                options={[
                  { value: "inHg", label: "inHg" },
                  { value: "hPa", label: "hPa" },
                  { value: "mb", label: "mb" },
                ]}
              />
            </UnitRow>

            <UnitRow label="Distance">
              <Segmented
                label="Distance unit"
                value={settings.units.distance}
                onChange={(value) => update({ units: { ...settings.units, distance: value } })}
                options={[
                  { value: "mi", label: "MI" },
                  { value: "km", label: "KM" },
                ]}
              />
            </UnitRow>

            <UnitRow label="Layout emphasis">
              <Segmented
                label="Layout emphasis"
                value={settings.emphasis}
                onChange={(value) => update({ emphasis: value })}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "workday", label: "Work" },
                  { value: "weekend", label: "Weekend" },
                ]}
              />
            </UnitRow>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Notifications"
          right={
            <span
              className={`text-[10px] font-semibold tracking-[0.1em] uppercase ${
                permission === "granted"
                  ? "text-level-good"
                  : permission === "denied"
                    ? "text-level-severe"
                    : "text-level-moderate"
              }`}
            >
              {permission === "unsupported" ? "unsupported" : permission}
            </span>
          }
        >
          {permission === "default" ? (
            <button
              type="button"
              onClick={async () => setPermission(await requestPermission())}
              className="inline-flex items-center gap-2 border border-line-strong bg-raised px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-fg uppercase"
            >
              <Bell className="size-3.5" />
              Enable browser notifications
            </button>
          ) : permission === "denied" ? (
            <p className="text-[11px] leading-snug text-level-moderate">
              Notifications are blocked for this site in your browser settings.
              The alerts below still appear in the Alert Center.
            </p>
          ) : permission === "unsupported" ? (
            <p className="text-[11px] leading-snug text-faint">
              This browser does not support notifications. The Alert Center still
              works.
            </p>
          ) : (
            <p className="text-[11px] leading-snug text-level-good">
              Notifications are enabled. Each alert notifies once per session.
            </p>
          )}

          <div className="mt-3 space-y-0.5 border-t hairline border-line pt-2">
            <Toggle
              checked={settings.notifications.severeWeather}
              onChange={(checked) =>
                update({ notifications: { ...settings.notifications, severeWeather: checked } })
              }
              label="Severe weather"
              hint="Official NWS warnings and watches"
            />
            <Toggle
              checked={settings.notifications.weatherChange}
              onChange={(checked) =>
                update({ notifications: { ...settings.notifications, weatherChange: checked } })
              }
              label="Major weather changes"
              hint="Large precipitation, wind or temperature changes in the forecast"
            />
            <Toggle
              checked={settings.notifications.traffic}
              onChange={(checked) =>
                update({ notifications: { ...settings.notifications, traffic: checked } })
              }
              label="Traffic"
              hint={`Accidents, and delays past ${settings.trafficThresholdMinutes} minutes`}
            />
            <Toggle
              checked={settings.notifications.roads}
              onChange={(checked) =>
                update({ notifications: { ...settings.notifications, roads: checked } })
              }
              label="Road closures and conditions"
            />
            <Toggle
              checked={settings.notifications.publicSafety}
              onChange={(checked) =>
                update({ notifications: { ...settings.notifications, publicSafety: checked } })
              }
              label="Public safety announcements"
              hint="Newly found publicly announced checkpoints"
            />
          </div>

          <p className="mt-2 text-[10px] leading-snug text-faint">
            Web push and email are not wired up. The notification rules live in
            lib/notifications/client.ts so another transport plugs into the same
            rules rather than duplicating them.
          </p>
        </DashboardCard>

        <DashboardCard
          title="Data Sources"
          subtitle="Public safety sources checked for announcements"
        >
          <div className="space-y-0.5">
            {sources.map((source) => (
              <Toggle
                key={source.id}
                checked={source.enabledByDefault && !disabled.includes(source.id)}
                onChange={(checked) =>
                  update({
                    disabledSources: checked
                      ? disabled.filter((id) => id !== source.id)
                      : [...disabled, source.id],
                  })
                }
                label={`${source.name} · ${source.transport.toUpperCase()}`}
                hint={source.note}
              />
            ))}
          </div>

          <div className="mt-3 border-t hairline border-line pt-2">
            <h3 className="micro">Last check</h3>
            <SourceStatusList sources={sourceStatuses} />
          </div>
        </DashboardCard>

        <DashboardCard title="Providers" subtitle="Configured for this deployment">
          <dl className="space-y-1 text-[11px]">
            <ProviderRow label="Weather" value={providers.weather} />
            <ProviderRow label="Radar" value={providers.radar} />
            <ProviderRow label="Traffic / routing" value={providers.traffic} />
            <ProviderRow label="Road conditions" value={providers.roads} />
          </dl>
        </DashboardCard>

        <DashboardCard title="Privacy">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
            <div className="text-[11px] leading-snug text-muted">
              {gateEnabled ? (
                <>
                  <p>
                    A passcode is configured, so the commute route and road
                    conditions are withheld until it is entered. This browser is
                    currently{" "}
                    <strong className={authorized ? "text-level-good" : "text-level-moderate"}>
                      {authorized ? "unlocked" : "locked"}
                    </strong>
                    .
                  </p>
                  {authorized ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/auth", { method: "DELETE" });
                        window.location.reload();
                      }}
                      className="mt-2 border hairline border-line px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-muted uppercase"
                    >
                      Lock this browser
                    </button>
                  ) : null}
                </>
              ) : (
                <p>
                  No passcode is configured. In development the commute route is
                  visible; on a production deployment the gate fails closed and
                  the route stays hidden until{" "}
                  <code className="text-fg">COMMAND_CENTER_PASSCODE</code> is
                  set, because a default that publishes where you live is the
                  wrong default.
                </p>
              )}
              <p className="mt-2">
                Settings and the dashboard snapshot are stored in this browser
                only. No account, no database, no analytics.
              </p>
            </div>
          </div>
        </DashboardCard>

        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 border hairline border-line px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:text-fg"
          >
            <RotateCcw className="size-3" />
            Reset settings to defaults
          </button>
        </div>
      </div>
    </>
  );
}

function UnitRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] tracking-wide text-faint uppercase">{label}</span>
      {children}
    </div>
  );
}

function ProviderRow({ label, value }: { label: string; value: string }) {
  const configured = !value.startsWith("Not configured");
  return (
    <div className="flex items-baseline justify-between gap-3 border-b hairline border-line/60 py-1 last:border-0">
      <dt className="tracking-wide text-faint uppercase">{label}</dt>
      <dd className={`text-right ${configured ? "text-fg" : "text-level-moderate"}`}>{value}</dd>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="micro">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-info)]"
        />
        <span className="tnum w-14 shrink-0 text-right font-mono text-[13px] text-fg">
          {value} min
        </span>
      </span>
      <span className="mt-1 block text-[10px] leading-snug text-faint">{hint}</span>
    </label>
  );
}
