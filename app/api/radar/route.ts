import { withModuleErrors } from "@/lib/api";
import { getRadar } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

/**
 * The radar frame index.
 *
 * Only the list of frames and their tile templates comes through here; the
 * browser then loads tiles from the provider directly, which is the only way
 * an animated radar loop stays responsive. The templates are provider URLs
 * with no key in them.
 */
export async function GET() {
  return withModuleErrors("radar", "Radar", getRadar);
}
