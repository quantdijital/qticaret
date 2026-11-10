import { promises as dns } from "node:dns"

/**
 * Whether the sender address's domain says who may mail for it (adr/0036
 * Ek 2026-11-10): SPF, DKIM and DMARC records, read from DNS. With the
 * shop's own mail server there is no provider to verify the domain, so the
 * panel shows these as a warning only; nothing waits on them (the owner's
 * rule: warn, don't block).
 *
 * - `found`: a record is published (for DKIM, under one of the selectors
 *   mail servers use by default; aaPanel's is `default`).
 * - `missing`: DNS answered and there is none.
 * - `unknown`: DNS did not answer in time; nothing is said.
 * Only presence is read: whether SPF names this server is the receiving
 * side's to judge, through includes this check does not follow.
 */

export type RecordState = "found" | "missing" | "unknown"

export interface SenderDns {
  domain: string
  spf: RecordState
  dkim: RecordState
  /** The selector a DKIM key was found under. */
  dkim_selector: string | null
  dmarc: RecordState
}

export interface TxtResolver {
  resolveTxt: (name: string) => Promise<string[][]>
}

export const DKIM_SELECTORS = ["default", "mail", "dkim", "smtp", "selector1", "s1", "k1", "x"]

const RESERVED = /(^|\.)(invalid|test|localhost|example|local)$/
const TIMEOUT_MS = 3_000
const KEPT_MS = 10 * 60 * 1000

const codeOf = (error: unknown): string =>
  typeof (error as { code?: unknown } | null)?.code === "string"
    ? (error as { code: string }).code
    : ""

/** The TXT strings at a name; [] when it has none, null when DNS did not answer. */
async function txt(resolver: TxtResolver, name: string): Promise<string[] | null> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null)
    }, TIMEOUT_MS)
    timer.unref()
  })
  try {
    const answer = await Promise.race([
      resolver.resolveTxt(name).then((records) => records.map((parts) => parts.join(""))),
      late,
    ])
    return answer
  } catch (error) {
    return ["ENOTFOUND", "ENODATA"].includes(codeOf(error)) ? [] : null
  } finally {
    clearTimeout(timer)
  }
}

const stateOf = (records: string[] | null, test: (record: string) => boolean): RecordState =>
  records === null ? "unknown" : records.some(test) ? "found" : "missing"

export async function readSenderDns(
  address: string,
  resolver: TxtResolver = dns
): Promise<SenderDns> {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase()
  const [spf, dmarc, ...keys] = await Promise.all([
    txt(resolver, domain),
    txt(resolver, `_dmarc.${domain}`),
    ...DKIM_SELECTORS.map((selector) => txt(resolver, `${selector}._domainkey.${domain}`)),
  ])
  const index = keys.findIndex((records) => (records ?? []).some((each) => /\bp=\S/.test(each)))
  return {
    domain,
    spf: stateOf(spf ?? null, (record) => /^v=spf1(\s|$)/i.test(record.trim())),
    dkim: index >= 0 ? "found" : keys.some((records) => records === null) ? "unknown" : "missing",
    dkim_selector: index >= 0 ? (DKIM_SELECTORS[index] ?? null) : null,
    dmarc: stateOf(dmarc ?? null, (record) => /^v=DMARC1(\s|;|$)/i.test(record.trim())),
  }
}

const kept = new Map<string, { until: number; value: SenderDns }>()
const asking = new Map<string, Promise<SenderDns>>()

// A DNS that did not answer is asked again sooner
const UNKNOWN_KEPT_MS = 60 * 1000

/**
 * The same, read again at most every ten minutes per domain (a minute when
 * DNS did not answer), one lookup at a time: every role reads the e-mail
 * tab, and each read would otherwise ask DNS ten times (security review).
 */
export async function senderDnsOf(
  address: string,
  resolver: TxtResolver = dns,
  now: () => number = Date.now
): Promise<SenderDns> {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase()
  const hit = kept.get(domain)
  if (hit && now() < hit.until) {
    return hit.value
  }
  // Names that never reach the Internet's DNS (RFC 2606, 6761): nothing to ask
  if (RESERVED.test(domain)) {
    return { domain, spf: "missing", dkim: "missing", dkim_selector: null, dmarc: "missing" }
  }
  const running = asking.get(domain)
  if (running) {
    return running
  }
  const lookup = readSenderDns(address, resolver)
    .then((value) => {
      if (kept.size > 100) {
        kept.clear()
      }
      const unknown = [value.spf, value.dkim, value.dmarc].includes("unknown")
      kept.set(domain, { until: now() + (unknown ? UNKNOWN_KEPT_MS : KEPT_MS), value })
      return value
    })
    .finally(() => {
      asking.delete(domain)
    })
  asking.set(domain, lookup)
  return lookup
}

/** Forgets what was read (tests). */
export function forgetSenderDns(): void {
  kept.clear()
}
