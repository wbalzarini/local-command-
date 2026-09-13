import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

/**
 * The passcode gate.
 *
 * This app knows where its owner lives: the commute route traces a line from
 * their front door to their desk. On a deployment reachable from the open
 * internet that has to be behind something, so when COMMAND_CENTER_PASSCODE is
 * set, the commute and road modules return `locked` until the passcode has been
 * entered — and they return it *as data*, so a locked deployment renders a lock
 * card rather than leaking the route through a component that forgot to check.
 *
 * **The gate fails closed in production.** With no passcode configured, a
 * production build locks the route anyway and says why. The alternative —
 * defaulting to open — means one forgotten environment variable publishes the
 * owner's home location, and a default whose failure mode is "publishes your
 * address" is the wrong default however convenient it is. Development builds
 * stay open, because there the deployment is localhost.
 *
 * The cookie holds a hash of the passcode rather than the passcode, is
 * httpOnly so script cannot read it, and is compared in constant time. This is
 * a front-door lock for a personal dashboard, not an identity system: there are
 * no accounts here, by design.
 */

const COOKIE_NAME = "cc_gate";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function tokenFor(passcode: string): string {
  // Domain-separated so the digest is not a bare password hash.
  return createHash("sha256").update(`command-center:${passcode}`).digest("hex");
}

/**
 * What kind of gate this deployment has.
 *
 *  - `off`: development with no passcode. The route is shown.
 *  - `passcode`: a passcode is configured and can be entered.
 *  - `unconfigured`: production with no passcode. Locked, and no passcode
 *    exists to enter — the operator has to set one. The UI says exactly that
 *    rather than showing an input that cannot succeed.
 */
export type GateMode = "off" | "passcode" | "unconfigured";

export function gateMode(): GateMode {
  if (env.passcode()) return "passcode";
  return process.env.NODE_ENV === "production" ? "unconfigured" : "off";
}

/** True when the route may be shown to this request. */
export async function isAuthorized(): Promise<boolean> {
  const mode = gateMode();
  if (mode === "off") return true;
  // Nothing can unlock an unconfigured gate; that is the point of it.
  if (mode === "unconfigured") return false;

  const passcode = env.passcode();
  if (!passcode) return false;

  const jar = await cookies();
  const presented = jar.get(COOKIE_NAME)?.value;
  if (!presented) return false;

  return safeEqual(presented, tokenFor(passcode));
}

/** Why a module is locked, worded for whoever is looking at it. */
export function lockMessage(subject: string): string {
  return gateMode() === "unconfigured"
    ? `${subject} is hidden because COMMAND_CENTER_PASSCODE is not set on this deployment. The route identifies a home location, so it stays hidden until a passcode is configured.`
    : `Enter the passcode to show ${subject.toLowerCase()}. It is withheld because the route identifies a home location.`;
}

export type GateResult = { ok: boolean; message?: string };

export async function openGate(candidate: string): Promise<GateResult> {
  const passcode = env.passcode();
  if (!passcode) return { ok: true };

  if (!safeEqual(tokenFor(candidate), tokenFor(passcode))) {
    return { ok: false, message: "Incorrect passcode." };
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, tokenFor(passcode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true };
}

export async function closeGate(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Whether this deployment has a gate at all, for the UI to show the right state. */
export function gateEnabled(): boolean {
  return gateMode() !== "off";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
