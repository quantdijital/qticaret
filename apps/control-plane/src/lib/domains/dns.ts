import { Resolver } from "node:dns/promises"
import type { DnsFinding, RoutingFinding, RoutingTarget, TxtFinding } from "./verification"
import { TXT_VALUE_PREFIX, txtNameOf, txtValueOf } from "./verification"

/**
 * DNS questions for a domain's check (F16.7), and nothing else: no
 * connection is made to the host or to any address it names, so a
 * domain pointing inside our network reaches nothing (no SSRF). Public
 * resolvers are asked (not the machine's, which may know internal
 * names), each question bounded in time and tries, the whole check too.
 */

/** The questions a check asks; a test passes its own answers. */
export interface DnsLookup {
  txt: (name: string) => Promise<string[][]>
  cname: (name: string) => Promise<string[]>
  addresses: (name: string) => Promise<string[]>
}

const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8", "9.9.9.9"]
const QUERY_TIMEOUT_MS = 2_000
const QUERY_TRIES = 2
/** The whole check: every question within it, or `unavailable`. */
export const CHECK_TIMEOUT_MS = 8_000

/** Answers that mean "no such record" rather than "DNS did not answer". */
const NO_RECORD = new Set(["ENODATA", "ENOTFOUND", "NOTFOUND", "ENONAME"])

const codeOf = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""

/** An empty answer for "no such record"; throws for DNS failing (timeout, refused, servfail). */
async function orEmpty<T>(question: Promise<T[]>): Promise<T[]> {
  try {
    return await question
  } catch (error) {
    if (NO_RECORD.has(codeOf(error))) {
      return []
    }
    throw error
  }
}

/** The public resolvers, bounded; under NODE_ENV=test the fake's answers (`CP_DNS_FAKE`). */
export function defaultDnsLookup(): DnsLookup {
  const fake = fakeLookup()
  if (fake) {
    return fake
  }
  const resolver = new Resolver({ timeout: QUERY_TIMEOUT_MS, tries: QUERY_TRIES })
  resolver.setServers(PUBLIC_RESOLVERS)
  return {
    txt: (name) => resolver.resolveTxt(name),
    cname: (name) => resolver.resolveCname(name),
    addresses: async (name) => {
      const [v4, v6] = await Promise.all([
        orEmpty(resolver.resolve4(name)),
        orEmpty(resolver.resolve6(name)),
      ])
      return [...v4, ...v6]
    },
  }
}

/**
 * The HTTP tests' DNS (NODE_ENV=test only): `CP_DNS_FAKE` is JSON
 * `{ "<name>": { "txt"?: string[][], "cname"?: string[], "addresses"?: string[], "fail"?: true } }`;
 * a name not listed has no records. Read at each question, so a test
 * changes the answers between calls.
 */
export const DNS_FAKE_ENV = "CP_DNS_FAKE"

interface FakeRecord {
  txt?: string[][]
  cname?: string[]
  addresses?: string[]
  fail?: boolean
}

function fakeLookup(): DnsLookup | null {
  if (process.env["NODE_ENV"] !== "test" || !process.env[DNS_FAKE_ENV]) {
    return null
  }
  const record = (name: string): FakeRecord => {
    const all = JSON.parse(process.env[DNS_FAKE_ENV] ?? "{}") as Record<string, FakeRecord>
    const found = Object.hasOwn(all, name) ? all[name] : undefined
    if (found?.fail) {
      throw Object.assign(new Error("queryTxt ETIMEOUT"), { code: "ETIMEOUT" })
    }
    if (!found) {
      throw Object.assign(new Error("queryTxt ENOTFOUND"), { code: "ENOTFOUND" })
    }
    return found
  }
  const answer = <T>(name: string, pick: (found: FakeRecord) => T[] | undefined) =>
    Promise.resolve().then(() => {
      const values = pick(record(name))
      if (!values || values.length === 0) {
        throw Object.assign(new Error("ENODATA"), { code: "ENODATA" })
      }
      return values
    })
  return {
    txt: (name) => answer(name, (found) => found.txt),
    cname: (name) => answer(name, (found) => found.cname),
    addresses: (name) => answer(name, (found) => found.addresses),
  }
}

const bare = (host: string) => host.toLowerCase().replace(/\.$/, "")

async function txtFinding(lookup: DnsLookup, hostname: string, token: string): Promise<TxtFinding> {
  // A TXT record may arrive in 255-byte chunks: joined before comparing
  const values = (await orEmpty(lookup.txt(txtNameOf(hostname)))).map((chunks) =>
    chunks.join("").trim()
  )
  if (values.includes(txtValueOf(token))) {
    return "match"
  }
  return values.some((value) => value.startsWith(TXT_VALUE_PREFIX)) ? "mismatch" : "missing"
}

async function routingFinding(
  lookup: DnsLookup,
  hostname: string,
  target: RoutingTarget
): Promise<RoutingFinding> {
  if (!target.cname && target.addresses.length === 0) {
    return "unknown"
  }
  const cnames = (await orEmpty(lookup.cname(hostname))).map(bare)
  if (target.cname && cnames.includes(target.cname)) {
    return "match"
  }
  const addresses = (await orEmpty(lookup.addresses(hostname))).map((each) => each.toLowerCase())
  if (addresses.length === 0 && cnames.length === 0) {
    return "missing"
  }
  // Every address the host answers with is ours (a flattened CNAME to the target included)
  const ours = new Set(target.addresses)
  if (target.cname && addresses.length > 0) {
    for (const each of await orEmpty(lookup.addresses(target.cname))) {
      ours.add(each.toLowerCase())
    }
  }
  return addresses.length > 0 && addresses.every((each) => ours.has(each)) ? "match" : "mismatch"
}

/**
 * The domain checked: its proof and its routing, each `unavailable` when
 * DNS did not answer (in time). Never throws.
 */
export async function checkDomainDns(
  hostname: string,
  token: string,
  target: RoutingTarget,
  lookup: DnsLookup = defaultDnsLookup(),
  timeoutMs = CHECK_TIMEOUT_MS
): Promise<DnsFinding> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      resolve("timeout")
    }, timeoutMs)
  })
  const bounded = async <T>(work: Promise<T>, fallback: T): Promise<T> => {
    try {
      const result = await Promise.race([work, deadline])
      return result === "timeout" ? fallback : result
    } catch {
      return fallback
    }
  }
  try {
    const [txt, routing] = await Promise.all([
      bounded<TxtFinding>(txtFinding(lookup, hostname, token), "unavailable"),
      bounded<RoutingFinding>(routingFinding(lookup, hostname, target), "unavailable"),
    ])
    return { txt, routing }
  } finally {
    clearTimeout(timer)
  }
}
