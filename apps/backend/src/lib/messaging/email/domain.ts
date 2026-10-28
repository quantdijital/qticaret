import { promises as dns } from "node:dns"
import { domainToASCII } from "node:url"

/**
 * Whether an address's domain takes mail at all (F10 M9): a shopper's
 * typo or a made-up address bounces, and bounces cost the shop's sender
 * its reputation. A domain takes mail by its MX records, or without any by
 * its own address (RFC 5321 §5.1); a "null MX" says it takes none (RFC
 * 7505). Only a clear no refuses: a slow or failing DNS lets it through.
 */

export interface MailResolver {
  resolveMx: (domain: string) => Promise<{ exchange: string; priority: number }[]>
  resolve4: (domain: string) => Promise<string[]>
  resolve6: (domain: string) => Promise<string[]>
}

export interface MailDomainOptions {
  resolver?: MailResolver
  timeoutMs?: number
  now?: () => number
}

// Names that never reach a mailbox on the Internet (RFC 2606, 6761, 6762)
const RESERVED = /(^|\.)(invalid|test|localhost|example|local)$/

const HOUR = 60 * 60 * 1000
// A yes holds for a day, a no for an hour: a domain set up a minute ago
// is not kept out for long
const ACCEPTS_FOR = 24 * HOUR
const REFUSES_FOR = HOUR
const MAX_DOMAINS = 10_000

const codeOf = (error: unknown): string =>
  typeof (error as { code?: unknown } | null)?.code === "string"
    ? (error as { code: string }).code
    : ""

// Neither the domain nor the record type exists: a clear no
const isAbsent = (error: unknown) => ["ENOTFOUND", "ENODATA"].includes(codeOf(error))

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("dns timeout"), { code: "ETIMEOUT" }))
    }, ms)
    timer.unref()
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

/** The domain of an address as DNS knows it (IDN in ASCII), or null when it has none. */
export function mailDomainOf(address: string): string | null {
  const at = address.lastIndexOf("@")
  const domain = domainToASCII(
    address
      .slice(at + 1)
      .trim()
      .toLowerCase()
      .replace(/\.$/, "")
  )
  return at > 0 && domain.includes(".") ? domain : null
}

/**
 * A domain check with its own cache. It answers false only when DNS says
 * the domain does not exist or takes no mail.
 */
export function createMailDomainCheck(options: MailDomainOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 2000
  const resolver: MailResolver =
    options.resolver ?? new dns.Resolver({ timeout: timeoutMs, tries: 1 })
  const now = options.now ?? Date.now
  const known = new Map<string, { accepts: boolean; until: number }>()

  // Without MX the domain's own address takes mail; null: DNS could not tell
  async function hasAddress(domain: string): Promise<boolean | null> {
    const found = await Promise.allSettled([
      within(resolver.resolve4(domain), timeoutMs),
      within(resolver.resolve6(domain), timeoutMs),
    ])
    if (found.some((each) => each.status === "fulfilled" && each.value.length > 0)) {
      return true
    }
    return found.every((each) => each.status === "rejected" && isAbsent(each.reason)) ? false : null
  }

  async function lookUp(domain: string): Promise<boolean | null> {
    try {
      const records = await within(resolver.resolveMx(domain), timeoutMs)
      if (records.length === 0) {
        return await hasAddress(domain)
      }
      return records.some((record) => record.exchange !== "" && record.exchange !== ".")
    } catch (error) {
      if (codeOf(error) === "ENOTFOUND") {
        return false
      }
      return codeOf(error) === "ENODATA" ? await hasAddress(domain) : null
    }
  }

  return async (address: string): Promise<boolean> => {
    const domain = mailDomainOf(address)
    if (domain === null || RESERVED.test(domain)) {
      return false
    }
    const time = now()
    const cached = known.get(domain)
    if (cached && cached.until > time) {
      return cached.accepts
    }
    const accepts = await lookUp(domain)
    if (accepts === null) {
      return true
    }
    known.delete(domain)
    known.set(domain, { accepts, until: time + (accepts ? ACCEPTS_FOR : REFUSES_FOR) })
    // A flood of distinct domains cannot grow memory without bound
    if (known.size > MAX_DOMAINS) {
      const oldest = known.keys().next()
      if (oldest.done !== true) {
        known.delete(oldest.value)
      }
    }
    return accepts
  }
}
