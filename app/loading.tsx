import { Loading } from "@/components/ui/primitives";

/**
 * Shown while a module's server data is assembling.
 *
 * Mirrors the real layout's rhythm — a wide block, a row of three, a wide
 * block — so navigating between modules does not jump as the content lands.
 */
export default function CommandLoading() {
  return (
    <div className="space-y-3 px-3 py-3 sm:px-4">
      <div className="border hairline border-line bg-surface/60 px-3 py-4">
        <Loading lines={4} label="Loading dashboard" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="border hairline border-line bg-surface/60 px-3 py-4">
            <Loading lines={2} />
          </div>
        ))}
      </div>

      <div className="border hairline border-line bg-surface/60 px-3 py-4">
        <Loading lines={3} />
      </div>
    </div>
  );
}
