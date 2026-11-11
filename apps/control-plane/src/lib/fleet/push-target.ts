import { isLocalEnv } from "@qticaret/server-kit"

/**
 * Where a shop's plan document may be pushed (adr/0061 §3.4, Ek C9 and its
 * review L4). The target is the shop backend's internal address (a Docker
 * network name once deployed), so the public-address rule of the shop's
 * `safe-fetch` is the wrong one here; instead an allowlist of the
 * platform's own network:
 *
 * - `CP_TENANT_API_HOSTS`, comma-separated entries `name[:port]`. A name is
 *   a single-label host (`tenant-mylarte`, a Docker service) or one under
 *   an internal namespace (`shop.internal`, `shop.local`); a `.suffix`
 *   entry (`.tenants.internal`, `.internal`) only in those namespaces. An
 *   entry without a port allows 9000 (Medusa's), 80 and 443 only.
 * - on a developer's machine and in tests, this machine too, on 9000 and
 *   the local provisioner's 9200–9299 (adr/0061 §6.3)
 * - a base URL only: no credentials, query, fragment or path; `http:` is
 *   fine (the internal network; the document is signed, holds no secret)
 *
 * The push follows no redirect, waits at most a few seconds and never
 * reads the answer's body (push.ts). C10's provisioner checks a shop's
 * address with `tenantApiUrlProblem` before it stores one.
 */

export const DEFAULT_PUSH_PORTS: readonly number[] = [9000, 80, 443]
const LOCAL_PORTS = (port: number) => port === 9000 || (port >= 9200 && port <= 9299)

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
const SINGLE = new RegExp(`^${LABEL}$`)
const INTERNAL = new RegExp(`^(?:${LABEL}\\.)*${LABEL}\\.(?:internal|local)$`)
const SUFFIX = new RegExp(`^\\.(?:(?:${LABEL}\\.)*${LABEL}\\.)?(?:internal|local)$`)
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

export interface HostEntry {
  /** A host name, or a suffix starting with a dot. */
  host: string
  /** The one port allowed; null for the defaults. */
  port: number | null
}

export interface PushPolicy {
  /** Development or test: this machine is allowed too. */
  local: boolean
  hosts: readonly HostEntry[]
}

function parseEntry(raw: string): HostEntry | null {
  const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(raw)
  if (!match?.[1]) {
    return null
  }
  const host = match[1]
  const port = match[2] === undefined ? null : Number(match[2])
  if (port !== null && (port < 1 || port > 65535)) {
    return null
  }
  const named = host.startsWith(".") ? SUFFIX.test(host) : SINGLE.test(host) || INTERNAL.test(host)
  return named && host.length <= 200 ? { host, port } : null
}

/** `CP_TENANT_API_HOSTS` as entries; throws (naming the variable only) on a bad one. */
export function parseTenantApiHosts(value: string | undefined): HostEntry[] {
  const entries = (value ?? "")
    .split(",")
    .map((each) => each.trim().toLowerCase())
    .filter((each) => each !== "")
    .map(parseEntry)
  if (entries.some((entry) => entry === null)) {
    throw new Error(
      "CP_TENANT_API_HOSTS must list single-label names or names under .internal/.local, with an optional port"
    )
  }
  return entries as HostEntry[]
}

const portOf = (url: URL): number =>
  url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port)

function allowed(host: string, port: number, policy: PushPolicy): boolean {
  if (policy.local && (LOOPBACK.has(host) || host.endsWith(".localhost")) && LOCAL_PORTS(port)) {
    return true
  }
  return policy.hosts.some((entry) => {
    const named = entry.host.startsWith(".")
      ? host.endsWith(entry.host) && host.length > entry.host.length
      : host === entry.host
    const ports = entry.port === null ? DEFAULT_PUSH_PORTS : [entry.port]
    return named && ports.includes(port)
  })
}

/** Why `base` may not be a push target, as a code; null when it may. */
export function pushTargetProblem(base: string, policy: PushPolicy): string | null {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return "target_invalid"
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "target_invalid"
  }
  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    return "target_invalid"
  }
  if (url.pathname !== "/" || base.includes("?") || base.includes("#")) {
    return "target_invalid"
  }
  return allowed(url.hostname.toLowerCase(), portOf(url), policy) ? null : "target_not_allowed"
}

/** The push policy from the environment. */
export const pushPolicy = (env: NodeJS.ProcessEnv = process.env): PushPolicy => ({
  local: isLocalEnv({ NODE_ENV: env["NODE_ENV"] }),
  hosts: parseTenantApiHosts(env["CP_TENANT_API_HOSTS"]),
})

/** A shop's internal base URL checked against the environment's policy (C10's provisioner, `cp:fleet`). */
export const tenantApiUrlProblem = (
  base: string,
  env: NodeJS.ProcessEnv = process.env
): string | null => pushTargetProblem(base, pushPolicy(env))

/** The shop's push endpoint under its base URL. */
export const pushUrl = (base: string): string =>
  new URL("/hooks/control-plane/plan", base).toString()
