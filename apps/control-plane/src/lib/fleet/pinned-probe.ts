import type { LookupAddress } from "node:dns"
import http from "node:http"
import type { IncomingMessage } from "node:http"
import https from "node:https"
import { BlockList, isIP } from "node:net"
import { isBlockedAddress, raceAbort, systemResolver } from "@qticaret/server-kit"
import type { Resolver } from "@qticaret/server-kit"
import type { HealthTarget } from "../../modules/fleet/models/health"
import { PROBE_TIMEOUT_MS, statusOutcome } from "./health-rules"
import type { ProbeResult } from "./health-rules"

/**
 * The storefront probe's connection (Ek C13 review L2): a storefront's
 * address is public and named by DNS, so the name is resolved once, every
 * answer is checked, and the connection goes to the checked address only
 * (the backend's safe-fetch pattern; its address rule and resolver are
 * shared through server-kit). A second DNS answer cannot point inside.
 *
 * - deployed: only public unicast addresses (no loopback, private,
 *   link-local and metadata, CGNAT, reserved; `isBlockedAddress`)
 * - on a developer's machine and in tests: loopback only (the policy
 *   already allows only this machine's names there)
 *
 * `GET`, no redirect followed (a 3xx is a failure), the body never read,
 * a fresh connection each time (a pooled socket would skip the pin).
 */

export interface PinPolicy {
  resolve: Resolver
  isAddressAllowed: (address: string) => boolean
}

const loopback = new BlockList()
loopback.addSubnet("127.0.0.0", 8, "ipv4")
loopback.addAddress("::1", "ipv6")

const isLoopback = (address: string): boolean => {
  const family = isIP(address)
  return family !== 0 && loopback.check(address, family === 4 ? "ipv4" : "ipv6")
}

// c-ares skips /etc/hosts: this machine's names are answered here, locally only
const LOCAL_NAME = /^(?:localhost|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.localhost)$/
const localResolver: Resolver = async (hostname, signal) =>
  LOCAL_NAME.test(hostname)
    ? [{ address: "127.0.0.1", family: 4 }]
    : await systemResolver(hostname, signal)

/** The rule for where a storefront probe may connect. */
export const pinPolicy = (local: boolean): PinPolicy =>
  local
    ? { resolve: localResolver, isAddressAllowed: isLoopback }
    : { resolve: systemResolver, isAddressAllowed: (address) => !isBlockedAddress(address) }

class Refused extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

async function pin(host: string, policy: PinPolicy, signal: AbortSignal): Promise<LookupAddress> {
  let addresses: readonly LookupAddress[]
  if (isIP(host) !== 0) {
    addresses = [{ address: host, family: isIP(host) }]
  } else {
    try {
      addresses = await raceAbort(policy.resolve(host, signal), signal)
    } catch (error) {
      if (signal.aborted) {
        throw error
      }
      throw new Refused("health.dns_failed")
    }
  }
  const [first] = addresses
  if (!first) {
    throw new Refused("health.dns_failed")
  }
  // One disallowed answer is enough: whoever runs the name decides which one is used
  if (addresses.some(({ address }) => !policy.isAddressAllowed(address))) {
    throw new Refused("health.address_not_allowed")
  }
  return first
}

function send(url: URL, host: string, pinned: LookupAddress, signal: AbortSignal) {
  const transport = url.protocol === "https:" ? https : http
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = transport.request(
      {
        hostname: host,
        port: url.port === "" ? undefined : Number(url.port),
        path: "/",
        method: "GET",
        headers: { accept: "*/*", "user-agent": "qticaret-control-plane-health" },
        agent: false,
        signal,
        // The checked address, never a new DNS answer; TLS still verifies the name
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [pinned])
          } else {
            callback(null, pinned.address, pinned.family)
          }
        },
      },
      resolve
    )
    request.on("error", reject)
    request.end()
  })
}

/** A storefront's home page, probed at a checked address. Nothing is thrown. */
export async function probePinned(
  base: string,
  target: HealthTarget,
  policy: PinPolicy,
  timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<ProbeResult> {
  const failed = (error: string): ProbeResult => ({
    target,
    ok: false,
    status_code: null,
    latency_ms: null,
    error,
  })
  const url = new URL(base)
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1")
  const signal = AbortSignal.timeout(timeoutMs)
  const started = performance.now()
  try {
    const pinned = await pin(host, policy, signal)
    const response = await send(url, host, pinned, signal)
    const latency = Math.max(0, Math.round(performance.now() - started))
    response.destroy()
    const status = response.statusCode ?? 0
    return { target, ...statusOutcome(status), status_code: status, latency_ms: latency }
  } catch (error) {
    if (error instanceof Refused) {
      return failed(error.code)
    }
    return failed(signal.aborted ? "health.timeout" : "health.unreachable")
  }
}
