import type { LookupAddress } from "node:dns"
import { Resolver as DnsResolver } from "node:dns/promises"

export type Resolver = (hostname: string, signal: AbortSignal) => Promise<readonly LookupAddress[]>

const asError = (reason: unknown, message: string): Error =>
  reason instanceof Error ? reason : new Error(message, { cause: reason })

/**
 * Asks DNS through c-ares, not `dns.lookup`: getaddrinfo holds one of the
 * four libuv threads until the system gives up (10-30 s), so a few names
 * whose servers never answer would stall file I/O, crypto and zlib for the
 * whole instance. c-ares queries can be cancelled when the request times
 * out. It skips /etc/hosts, so `localhost` does not resolve: still refused.
 */
export const systemResolver: Resolver = async (hostname, signal) => {
  signal.throwIfAborted()
  const resolver = new DnsResolver({ timeout: 2000, tries: 2 })
  const cancel = () => {
    resolver.cancel()
  }
  signal.addEventListener("abort", cancel, { once: true })
  try {
    const [v4, v6] = await Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname),
    ])
    signal.throwIfAborted()
    const addresses: LookupAddress[] = [
      ...(v4.status === "fulfilled" ? v4.value.map((address) => ({ address, family: 4 })) : []),
      ...(v6.status === "fulfilled" ? v6.value.map((address) => ({ address, family: 6 })) : []),
    ]
    if (addresses.length === 0 && v4.status === "rejected") {
      throw asError(v4.reason, "lookup failed")
    }
    return addresses
  } finally {
    signal.removeEventListener("abort", cancel)
  }
}

// An injected resolver may ignore the signal; the race keeps it inside the timeout
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(asError(signal.reason, "aborted"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(asError(error, "lookup failed"))
      }
    )
  })
}
