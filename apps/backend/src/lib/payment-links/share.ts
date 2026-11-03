import { messageText } from "../messaging/texts"

/**
 * What staff send the customer (adr/0051 §7): one sentence with the shop,
 * the total, how long the link opens and the link. No name, no address:
 * whoever sees the text sees only what the link page shows. WhatsApp opens
 * in the staff member's own app with the text filled in (no API).
 */

const HOUR_MS = 60 * 60 * 1000

/** "72 saat" under two days, "3 gün" from then on; at least an hour. */
export function validityText(expiresAt: Date | string, now = new Date()): string {
  const hours = Math.max(1, Math.round((new Date(expiresAt).getTime() - now.getTime()) / HOUR_MS))
  return hours < 48
    ? messageText("payment_link.hours", { count: hours })
    : messageText("payment_link.days", { count: Math.round(hours / 24) })
}

export const formatLira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount / 100)

export interface ShareInput {
  shopName: string
  /** Kuruş. */
  total: number
  expiresAt: Date | string
  url: string
  now?: Date
}

/** The text an SMS or a WhatsApp message carries. */
export const shareText = (input: ShareInput): string =>
  messageText("payment_link.sms", {
    shop: input.shopName,
    total: formatLira(input.total),
    validity: validityText(input.expiresAt, input.now),
    url: input.url,
  })

/** Digits WhatsApp takes: a Turkish mobile as 90 5xx…; null for anything else. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "")
  const national = digits.replace(/^(?:90|0)/, "")
  return /^5\d{9}$/.test(national) ? `90${national}` : null
}

/** `https://wa.me/<number>?text=…`, or without a number for staff to pick the chat. */
export function whatsappUrl(text: string, phone: string | null | undefined): string {
  const number = whatsappNumber(phone)
  return `https://wa.me/${number ?? ""}?${new URLSearchParams({ text }).toString()}`
}
