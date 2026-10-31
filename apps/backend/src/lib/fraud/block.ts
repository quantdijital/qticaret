import { isIP } from "node:net"
import { hashPii } from "../crypto/pii"
import { maskRecipient, normalizeRecipient } from "../messaging/recipients"
import { normalizeTrPhone } from "../tr/phone"

/**
 * How a block list entry is kept and found (F15.6, adr/0044 §4): one
 * spelling per value, an e-mail or a phone as its keyed hash, a domain or
 * an IP address as written. Null when the value is none of its kind.
 */

export type BlockKind = "email" | "email_domain" | "phone" | "ip"

export interface BlockEntry {
  kind: BlockKind
  match: string
  display: string
}

const DOMAIN = /^(?=.{3,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/

/** The entry a value makes, or null. */
export function blockEntryOf(kind: BlockKind, value: string, key: Buffer): BlockEntry | null {
  switch (kind) {
    case "email": {
      const email = normalizeRecipient("email", value)
      return email
        ? {
            kind,
            match: hashPii(email, key, "fraud.email"),
            display: maskRecipient("email", email),
          }
        : null
    }
    case "phone": {
      const phone = normalizeTrPhone(value)
      return phone
        ? { kind, match: hashPii(phone, key, "fraud.phone"), display: maskRecipient("sms", phone) }
        : null
    }
    case "email_domain": {
      const domain = value.trim().toLowerCase().replace(/^.*@/, "")
      return DOMAIN.test(domain) ? { kind, match: domain, display: domain } : null
    }
    case "ip": {
      const ip = value.trim().toLowerCase()
      return isIP(ip) ? { kind, match: ip, display: ip } : null
    }
  }
}

export interface Signals {
  email?: string | null | undefined
  phone?: string | null | undefined
  ip?: string | null | undefined
}

/** Every entry a request's signals could match: its e-mail, the e-mail's domain, its phone, its address. */
export function matchesOf(signals: Signals, key: Buffer): BlockEntry[] {
  const found: (BlockEntry | null)[] = []
  if (signals.email) {
    found.push(blockEntryOf("email", signals.email, key))
    found.push(blockEntryOf("email_domain", signals.email, key))
  }
  if (signals.phone) {
    found.push(blockEntryOf("phone", signals.phone, key))
  }
  if (signals.ip) {
    found.push(blockEntryOf("ip", signals.ip, key))
  }
  return found.filter((entry): entry is BlockEntry => entry !== null)
}
