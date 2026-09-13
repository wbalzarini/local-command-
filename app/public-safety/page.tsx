import { CommandHeader } from "@/components/command-center/CommandHeader";
import { PublicSafetyPanel } from "@/components/public-safety/PublicSafetyPanel";
import { PUBLIC_SAFETY_AREA } from "@/lib/config";
import { getPublicSafety } from "@/lib/sources/service";

/**
 * Dynamic: the source check and its per-source status are live readings.
 *
 * Without this the page prerenders, and "nothing found in monitored sources"
 * would be frozen at build time - the most misleading thing this module could
 * possibly say.
 */
export const dynamic = "force-dynamic";

/**
 * Public Safety.
 *
 * The scope note under the panel is part of the feature, not boilerplate: this
 * module aggregates announcements that agencies have chosen to publish, and
 * being explicit about that is what separates it from something that claims to
 * know where enforcement is.
 */
export default async function PublicSafetyPage() {
  const publicSafety = await getPublicSafety();

  const live =
    publicSafety.status.state === "ok"
      ? ("live" as const)
      : publicSafety.status.state === "unavailable"
        ? ("offline" as const)
        : ("degraded" as const);

  return (
    <>
      <CommandHeader
        location={`${PUBLIC_SAFETY_AREA.county}, ${PUBLIC_SAFETY_AREA.state}`}
        liveState={live}
      />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <PublicSafetyPanel publicSafety={publicSafety} />

        <section className="border hairline border-line bg-surface/40 px-3 py-2.5">
          <h2 className="micro micro-bright">Scope of this module</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
            <li>
              It aggregates checkpoint and enforcement information that agencies
              and news organisations have published publicly, and links each
              item to its original announcement.
            </li>
            <li>
              It does not infer, predict or estimate unannounced enforcement
              locations, and contains no guidance on avoiding law enforcement.
            </li>
            <li>
              It shows only what an announcement actually stated. A field an
              announcement did not include is marked as not stated rather than
              filled in.
            </li>
            <li>
              It never reports that no checkpoint exists. It reports whether
              anything was found in the sources it monitors, and how many of
              those sources answered.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
