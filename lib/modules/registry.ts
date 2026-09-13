/**
 * The module map for the whole application.
 *
 * Navigation, the Today page's section order and the workday/weekend emphasis
 * all read from this list, so adding a module means adding an entry here and a
 * service that returns a `ModuleSnapshot` — not touching the dashboard layout.
 * `state: "future"` entries render as placeholders, which is how the Life OS
 * roadmap stays visible without shipping empty screens.
 */

export type ModuleState = "active" | "placeholder" | "future";

export type ModuleDefinition = {
  id: string;
  label: string;
  href: string;
  /** Lucide icon name, resolved in components/command-center/ModuleIcon.tsx. */
  icon: string;
  state: ModuleState;
  /** Sub-sections, shown as tabs inside the module. */
  children?: { label: string; href: string }[];
  /** Short line shown on a placeholder screen. */
  note?: string;
};

export const MODULES: ModuleDefinition[] = [
  { id: "today", label: "Today", href: "/", icon: "LayoutDashboard", state: "active" },
  {
    id: "weather",
    label: "Weather",
    href: "/weather",
    icon: "CloudSun",
    state: "active",
    children: [
      { label: "Current", href: "/weather" },
      { label: "Radar", href: "/weather/radar" },
      { label: "Forecast", href: "/weather/forecast" },
      { label: "Trends", href: "/weather/trends" },
      { label: "History", href: "/weather/history" },
    ],
  },
  {
    id: "commute",
    label: "Commute",
    href: "/commute",
    icon: "Car",
    state: "active",
    children: [
      { label: "Overview", href: "/commute" },
      { label: "Routes", href: "/commute#routes" },
      { label: "Roads", href: "/commute#roads" },
      { label: "Departure", href: "/commute#departure" },
    ],
  },
  { id: "alerts", label: "Alerts", href: "/alerts", icon: "TriangleAlert", state: "active" },
  {
    id: "public-safety",
    label: "Public Safety",
    href: "/public-safety",
    icon: "ShieldAlert",
    state: "active",
  },
  {
    id: "outdoor",
    label: "Outdoor",
    href: "/outdoor",
    icon: "Trees",
    state: "placeholder",
    note: "Planned: comfort index, wind and UV windows, and an hour-by-hour read on whether outdoor plans hold.",
  },
];

/** Roadmap entries. Listed in navigation as future, with no route of their own. */
export const FUTURE_MODULES: ModuleDefinition[] = [
  { id: "calendar", label: "Calendar", href: "/outdoor", icon: "CalendarDays", state: "future" },
  { id: "news", label: "News", href: "/outdoor", icon: "Newspaper", state: "future" },
  { id: "home", label: "Home", href: "/outdoor", icon: "House", state: "future" },
  { id: "fishing", label: "Fishing", href: "/outdoor", icon: "Fish", state: "future" },
  { id: "travel", label: "Travel", href: "/outdoor", icon: "Plane", state: "future" },
  { id: "sports", label: "Sports", href: "/outdoor", icon: "Trophy", state: "future" },
];

export function moduleById(id: string): ModuleDefinition | undefined {
  return [...MODULES, ...FUTURE_MODULES].find((module) => module.id === id);
}

/**
 * Section order on Today.
 *
 * A workday leads with the commute, because on a workday the question is when
 * to leave. A weekend leads with the weather and pushes the commute to the
 * bottom, because on a weekend the question is what the day looks like.
 */
export const TODAY_ORDER = {
  workday: [
    "briefing",
    "day-status",
    "current-weather",
    "commute",
    "departure",
    "alerts",
    "next-6",
    "pressure",
    "trends",
    "air-quality",
    "radar",
    "forecast",
    "public-safety",
    "what-changed",
  ],
  weekend: [
    "briefing",
    "day-status",
    "current-weather",
    "alerts",
    "next-6",
    "air-quality",
    "pressure",
    "trends",
    "radar",
    "forecast",
    "public-safety",
    "commute",
    "departure",
    "what-changed",
  ],
} as const;

export type TodaySection = (typeof TODAY_ORDER)["workday"][number];
