import { parseDsn } from "./dsn"
import { createErrorTrackingStream } from "./stream"
import type { ErrorTrackingStream } from "./stream"

export { parseDsn } from "./dsn"
export type { ErrorTrackingDsn } from "./dsn"
export { eventOf, framesOf } from "./event"
export type { EventContext, LogLine, TrackedEvent } from "./event"
export { createErrorTrackingStream, envelopeOf } from "./stream"
export type { ErrorTrackingOptions, ErrorTrackingStream } from "./stream"

/**
 * Error tracking as the environment sets it (adr/0045), or null without
 * `ERROR_TRACKING_DSN`. Read from the raw environment: the logger is made
 * before anything else, and the environment check (lib/env.ts) refuses a
 * DSN that `parseDsn` would not read. The instance is named by its
 * backend's host, so one GlitchTip project can hold every shop.
 */
export function errorTrackingFromEnv(
  env: NodeJS.ProcessEnv,
  onFailure: (reason: string) => void
): ErrorTrackingStream | null {
  const value = env["ERROR_TRACKING_DSN"]
  const dsn = value ? parseDsn(value) : null
  if (!dsn) {
    return null
  }
  let serverName = "local"
  try {
    serverName = env["BACKEND_URL"] ? new URL(env["BACKEND_URL"]).host : serverName
  } catch {
    // The environment check reports a bad BACKEND_URL; the name stays "local"
  }
  return createErrorTrackingStream({
    dsn,
    context: {
      environment: env["NODE_ENV"] ?? "unknown",
      serverName,
      ...(env["RELEASE"] ? { release: env["RELEASE"] } : {}),
      root: process.cwd(),
    },
    onFailure,
  })
}
