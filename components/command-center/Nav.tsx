"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FUTURE_MODULES, MODULES } from "@/lib/modules/registry";
import { ModuleIcon } from "./ModuleIcon";

/**
 * Navigation, built from the module registry.
 *
 * Two presentations of one list: a rail on desktop, a scrolling bar at the
 * bottom on mobile where the thumb is. Future modules appear in the desktop
 * rail as dimmed, non-interactive entries — the roadmap is part of the product
 * here, and showing it costs nothing but says what this dashboard is becoming.
 */

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden w-44 shrink-0 flex-col border-r hairline border-line bg-surface/40 lg:flex"
      aria-label="Command Center modules"
    >
      <div className="px-3 py-3">
        <p className="micro">Command Center</p>
      </div>

      <ul className="flex-1 space-y-0.5 px-1.5">
        {MODULES.map((entry) => {
          const active = isActive(pathname, entry.href);
          return (
            <li key={entry.id}>
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 px-2 py-1.5 text-[12px] transition-colors ${
                  active
                    ? "bg-raised text-fg"
                    : "text-muted hover:bg-raised/50 hover:text-fg"
                }`}
              >
                <ModuleIcon name={entry.icon} />
                <span className="truncate">{entry.label}</span>
                {entry.state === "placeholder" ? (
                  <span className="ml-auto text-[9px] tracking-wider text-faint">SOON</span>
                ) : null}
              </Link>

              {active && entry.children ? (
                <ul className="mt-0.5 mb-1 ml-6 space-y-0.5 border-l hairline border-line pl-2">
                  {entry.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={`block py-0.5 text-[11px] transition-colors ${
                          pathname === child.href
                            ? "text-fg"
                            : "text-faint hover:text-muted"
                        }`}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}

        <li className="px-2 pt-3 pb-1">
          <span className="micro">Planned</span>
        </li>
        {FUTURE_MODULES.map((entry) => (
          <li key={entry.id}>
            <span
              className="flex cursor-default items-center gap-2 px-2 py-1 text-[12px] text-faint/70"
              title="Planned module"
            >
              <ModuleIcon name={entry.icon} className="size-3.5" />
              <span className="truncate">{entry.label}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t hairline border-line p-1.5">
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={`flex items-center gap-2 px-2 py-1.5 text-[12px] transition-colors ${
            pathname === "/settings" ? "bg-raised text-fg" : "text-muted hover:text-fg"
          }`}
        >
          Settings
        </Link>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const items = [...MODULES, { id: "settings", label: "Settings", href: "/settings", icon: "LayoutDashboard", state: "active" as const }];

  return (
    <nav
      className="scroll-none sticky bottom-0 z-30 flex overflow-x-auto border-t hairline border-line bg-ink/95 backdrop-blur lg:hidden"
      aria-label="Command Center modules"
    >
      {items.map((entry) => {
        const active = isActive(pathname, entry.href);
        return (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] tracking-wide transition-colors ${
              active ? "text-fg" : "text-faint"
            }`}
          >
            <ModuleIcon name={entry.icon} className="size-4" />
            <span className="truncate">{entry.label}</span>
            <span
              className={`h-0.5 w-6 rounded-full ${active ? "bg-info" : "bg-transparent"}`}
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </nav>
  );
}

/** Sub-navigation inside a module, shown on mobile where the rail is hidden. */
export function ModuleTabs({ moduleId }: { moduleId: string }) {
  const pathname = usePathname();
  const entry = MODULES.find((candidate) => candidate.id === moduleId);
  if (!entry?.children) return null;

  return (
    <div className="scroll-none flex gap-1 overflow-x-auto border-b hairline border-line px-3 py-2 lg:hidden">
      {entry.children.map((child) => (
        <Link
          key={child.href}
          href={child.href}
          className={`shrink-0 border px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${
            pathname === child.href
              ? "border-line-strong bg-raised text-fg"
              : "hairline border-line text-faint"
          }`}
        >
          {child.label}
        </Link>
      ))}
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
