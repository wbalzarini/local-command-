import {
  CalendarDays,
  Car,
  CloudSun,
  Fish,
  House,
  LayoutDashboard,
  Newspaper,
  Plane,
  ShieldAlert,
  Trees,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon lookup for the module registry.
 *
 * The registry stores an icon by name so it stays a plain data file with no
 * JSX in it; this is the one place those names are resolved. Importing the
 * icons individually keeps the bundle to the dozen actually used rather than
 * pulling in the whole set.
 */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Car,
  CloudSun,
  TriangleAlert,
  ShieldAlert,
  Trees,
  CalendarDays,
  Newspaper,
  House,
  Fish,
  Plane,
  Trophy,
};

export function ModuleIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
