import { parse as parseConnectionString } from "pg-connection-string"
import { isLocalEnv } from "./env"
import type { Env } from "./env"

/**
 * Why a developer's script (`cp:seed-dev`, the e2e owner, `cp:link-local`)
 * may not run here, or null (C7 review L3): only in development or test,
 * and only against a database on this machine, so a local `.env` pointing
 * at a deployed database is refused too. The URL is never named in the answer.
 */
export function localOnlyProblem(env: Pick<Env, "NODE_ENV" | "DATABASE_URL">): string | null {
  if (!isLocalEnv(env)) {
    return "only in development or test"
  }
  return isLocalDatabaseUrl(env.DATABASE_URL) ? null : "only against a database on this machine"
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"])

/**
 * Whether the Postgres URL connects to this machine, read the way the
 * driver reads it (pg-connection-string): its resolved host a loopback
 * name. A `host` or `hostaddr` query parameter (which the driver lets
 * override the URL's host), a socket path, an empty host or anything not
 * a `postgres(ql)://` URL is refused.
 */
export function isLocalDatabaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    return false
  }
  if (
    [...url.searchParams.keys()].some((key) => ["host", "hostaddr"].includes(key.toLowerCase()))
  ) {
    return false
  }
  try {
    const host = parseConnectionString(value).host
    return typeof host === "string" && LOOPBACK.has(host.toLowerCase())
  } catch {
    return false
  }
}
