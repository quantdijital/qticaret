/**
 * Where a shop's plan document may be pushed (adr/0061 §3.4, Ek C9). The
 * target is the shop backend's internal address (a Docker network name once
 * deployed), so the public-address rule of the shop's `safe-fetch` is the
 * wrong one here; instead an allowlist of the platform's own network:
 *
 * - `CP_TENANT_API_HOSTS`: host names (`tenant-mylarte`) or suffixes
 *   (`.tenants.internal`), comma-separated. Only these are pushed to;
 *   `http:` is fine for them (the internal network; the document is signed
 *   and holds no secret)
 * - on a developer's machine and in tests, this machine (loopback) too
 * - a base URL only: no credentials, query, fragment or path
 *
 * The push itself follows no redirect, waits at most a few seconds and
 * reads at most a few kilobytes of the answer (push.ts).
 */

const HOST_ENTRY = /^\.?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

export interface PushPolicy {
  /** Development or test: this machine is allowed too. */
  local: boolean
  hosts: readonly string[]
}

/** `CP_TENANT_API_HOSTS` as a list; throws (naming the variable only) on a bad entry. */
export function parseTenantApiHosts(value: string | undefined): string[] {
  const hosts = (value ?? "")
    .split(",")
    .map((each) => each.trim().toLowerCase())
    .filter((each) => each !== "")
  if (hosts.some((each) => !HOST_ENTRY.test(each) || each.length > 200)) {
    throw new Error("CP_TENANT_API_HOSTS must list host names or .suffixes")
  }
  return hosts
}

const hostAllowed = (host: string, policy: PushPolicy): boolean =>
  (policy.local && (LOOPBACK.has(host) || host.endsWith(".localhost"))) ||
  policy.hosts.some((entry) =>
    entry.startsWith(".") ? host.endsWith(entry) && host.length > entry.length : host === entry
  )

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
  return hostAllowed(url.hostname.toLowerCase(), policy) ? null : "target_not_allowed"
}

/** The shop's push endpoint under its base URL. */
export const pushUrl = (base: string): string =>
  new URL("/hooks/control-plane/plan", base).toString()
