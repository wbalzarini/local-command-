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

/** True when no passcode is configured, or the request carries a valid cookie. */
export async function isAuthorized(): Promise<boolean> {
  const passcode = env.passcode();
  if (!passcode) return true;

  const jar = await cookies();
  const presented = jar.get(COOKIE_NAME)?.value;
  if (!presented) return false;

  return safeEqual(presented, tokenFor(passcode));
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
  return Boolean(env.passcode());
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
