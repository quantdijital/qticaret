import { isLocalEnv } from "@qticaret/server-kit"

/**
 * Which storefront home page the health probe may ask for (Ek C13). Unlike
 * the backend's internal address (push-target.ts), a storefront is public:
 *
 * - deployed: `https` only, on the default port, and the host must be one
 *   of the shop's own **verified** domains (its platform subdomain or a
 *   verified custom domain): the probe can never be pointed at an address
 *   that is not the shop's
 * - on a developer's machine and in tests: this machine only, ports
 *   8000–8099 (the development storefront is `localhost:8000`)
 * - a base URL only: no credentials, query, fragment or path
 *
 * The probe follows no redirect, waits a few seconds and never reads the
 * page (health-probe.ts). Only staff's own CLI sets it today (`cp:fleet
 * set-storefront-url`, development only); F16's provisioner sets it on
 * deploy.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])
const LOCAL_PORTS = (port: number) => port >= 8000 && port <= 8099

export interface StorefrontPolicy {
  local: boolean
  /** The shop's verified host names, lower-cased. */
  verifiedHosts: readonly string[]
}

/** Why `base` may not be probed as this shop's storefront, as a code; null when it may. */
export function storefrontTargetProblem(base: string, policy: StorefrontPolicy): string | null {
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
  const host = url.hostname.toLowerCase()
  if (policy.local) {
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80))
    return (LOOPBACK.has(host) || host.endsWith(".localhost")) && LOCAL_PORTS(port)
      ? null
      : "target_not_allowed"
  }
  if (url.protocol !== "https:" || url.port !== "") {
    return "target_not_allowed"
  }
  return policy.verifiedHosts.includes(host) ? null : "target_not_allowed"
}

/** The policy for one shop, from the environment and its verified domains. */
export const storefrontPolicy = (
  verifiedHosts: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): StorefrontPolicy => ({
  local: isLocalEnv({ NODE_ENV: env["NODE_ENV"] }),
  verifiedHosts: verifiedHosts.map((host) => host.toLowerCase()),
})
