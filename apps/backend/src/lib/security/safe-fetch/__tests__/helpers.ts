import type { LookupAddress } from "node:dns"
import { isBlockedAddress } from "../address-policy"
import { SafeFetchError } from "../errors"
import type { Resolver } from "../resolver"
import { createSafeFetch } from "../safe-fetch"
import type { SafeFetchOptions } from "../safe-fetch"
import type { TestServer } from "./test-server"

export const LOOPBACK: LookupAddress = { address: "127.0.0.1", family: 4 }
export const PRIVATE: LookupAddress = { address: "10.0.0.1", family: 4 }

/** A resolver that answers in turn with each list (the last one repeats) and records the names. */
export function resolveTo(...answers: LookupAddress[][]): Resolver & { calls: string[] } {
  const calls: string[] = []
  const resolver = (hostname: string) => {
    calls.push(hostname)
    return Promise.resolve(answers[Math.min(calls.length - 1, answers.length - 1)] ?? [])
  }
  return Object.assign(resolver, { calls })
}

// The local test server stands in for a public host: these fetchers allow
// 127.0.0.1 explicitly and refuse every other address the real rule refuses
const allowLoopback = (address: string) => address === "127.0.0.1"

export const fetchAsPublic = (resolve: Resolver = resolveTo([LOOPBACK])) =>
  createSafeFetch({ resolve, isAddressAllowed: allowLoopback })

/** The real address rule with an injected resolver. */
export const fetchWithRealRule = (resolve: Resolver) =>
  createSafeFetch({ resolve, isAddressAllowed: (address) => !isBlockedAddress(address) })

export const publicUrl = (server: TestServer, path = "/") =>
  `http://public.test:${String(server.port)}${path}`

export const onPort = (server: TestServer, extra: SafeFetchOptions = {}): SafeFetchOptions => ({
  allowedPorts: [server.port],
  ...extra,
})

/** The refusal reason, or a thrown test failure when the call succeeds or fails otherwise. */
export async function failureOf(run: Promise<unknown>): Promise<string> {
  try {
    await run
  } catch (error) {
    if (error instanceof SafeFetchError) {
      return error.reason
    }
    throw error
  }
  throw new Error("expected safeFetch to fail")
}
