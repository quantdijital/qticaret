import { hashPii } from "@qticaret/server-kit"
import { maskRecipient, normalizeRecipient } from "../messaging/recipients"
import { ipBucket } from "../security/rate-limit"
import { normalizeTrPhone } from "../tr/phone"

/**
 * How a block list entry is kept and found (F15.6, adr/0044 §4): one
 * spelling per value, so the request and the entry meet whatever form
 * either was written in:
 * - an e-mail without its `+tag`, as its keyed hash;
 * - a domain in lower case, matching its subdomains too;
 * - a phone in E.164 (Turkish forms read as such), as its keyed hash;
 * - an IP address as the rate limits count it: IPv4-mapped IPv6 as IPv4,
 *   IPv6 by its /64 (one connection holds a whole /64).
 * Null when the value is none of its kind.
 */

export type BlockKind = "email" | "email_domain" | "phone" | "ip"

export interface BlockEntry {
  kind: BlockKind
  match: string
  display: string
}

const DOMAIN = /^(?=.{3,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/

/** The address its owner reads at: `ayse+kampanya@x.com` is `ayse@x.com`. */
const withoutTag = (email: string) => email.replace(/\+[^@]*@/, "@")

/** A phone in E.164: a Turkish one in any of its forms, another country's with its `+`. */
function phoneOf(value: string): string | null {
  const turkish = normalizeTrPhone(value)
  if (turkish) {
    return turkish
  }
  const digits = value.replace(/[\s().-]/g, "")
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null
}

/** The entry a value makes, or null. */
export function blockEntryOf(kind: BlockKind, value: string, key: Buffer): BlockEntry | null {
  switch (kind) {
    case "email": {
      const email = normalizeRecipient("email", value)
      return email
        ? {
            kind,
            match: hashPii(withoutTag(email), key, "fraud.email"),
            display: maskRecipient("email", email),
          }
        : null
    }
    case "phone": {
      const phone = phoneOf(value)
      return phone
        ? { kind, match: hashPii(phone, key, "fraud.phone"), display: maskRecipient("sms", phone) }
        : null
    }
    case "email_domain": {
      const domain = value.trim().toLowerCase().replace(/^.*@/, "")
      return DOMAIN.test(domain) ? { kind, match: domain, display: domain } : null
    }
    case "ip": {
      const bucket = ipBucket(value.trim().toLowerCase())
      return bucket ? { kind, match: bucket, display: bucket } : null
    }
  }
}

export interface Signals {
  email?: string | null | undefined
  /** Every phone the request carries (delivery and billing). */
  phones?: readonly (string | null | undefined)[]
  ip?: string | null | undefined
}

/** A domain and each parent above it: `a.b.example.com`, `b.example.com`, `example.com`. */
function domainsOf(email: string): string[] {
  const labels = (email.trim().toLowerCase().split("@")[1] ?? "").split(".")
  return labels.slice(0, -1).map((_, index) => labels.slice(index).join("."))
}

/** Every entry a request's signals could match. */
export function matchesOf(signals: Signals, key: Buffer): BlockEntry[] {
  const found: (BlockEntry | null)[] = []
  if (signals.email) {
    found.push(blockEntryOf("email", signals.email, key))
    for (const domain of domainsOf(signals.email)) {
      found.push(blockEntryOf("email_domain", domain, key))
    }
  }
  for (const phone of signals.phones ?? []) {
    if (phone) {
      found.push(blockEntryOf("phone", phone, key))
    }
  }
  if (signals.ip) {
    found.push(blockEntryOf("ip", signals.ip, key))
  }
  return found.filter((entry): entry is BlockEntry => entry !== null)
}
