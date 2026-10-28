import { normalizeTrPhone } from "../tr/phone"

/**
 * A message's recipient as the messaging records keep it (adr/0036): one
 * spelling per address, so a consent or a suppression is found whatever
 * case or spacing it arrives in, and a masked form for the panel. The
 * address itself is stored only as a keyed hash.
 */

export type MessageChannel = "email" | "sms"

// Enough of an address to tell where it goes; the full check is the provider's
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/

/** The address in its one spelling, or null when it is none of the channel's. */
export function normalizeRecipient(channel: MessageChannel, address: string): string | null {
  if (channel === "email") {
    const email = address.trim().toLowerCase()
    return EMAIL.test(email) && email.length <= 254 ? email : null
  }
  return normalizeTrPhone(address)
}

/** What the panel shows of an address: enough to recognise it, not to use it. */
export function maskRecipient(channel: MessageChannel, normalized: string): string {
  if (channel === "email") {
    const at = normalized.lastIndexOf("@")
    const local = normalized.slice(0, at)
    return `${local.slice(0, Math.min(2, local.length))}***${normalized.slice(at)}`
  }
  // +90 5xx xxx xx NN
  return `${normalized.slice(0, 4)}*** *** ** ${normalized.slice(-2)}`
}
