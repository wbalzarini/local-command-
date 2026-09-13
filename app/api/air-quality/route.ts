import { withModuleErrors } from "@/lib/api";
import { getAirQuality } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withModuleErrors("air-quality", "Air Quality", getAirQuality);
}
