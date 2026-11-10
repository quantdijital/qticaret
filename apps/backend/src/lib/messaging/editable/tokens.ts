import { LONGEST_NAME } from "../../campaigns/sms"

/**
 * What each `{belirteç}` may hold at send time (adr/0036 Ek 2026-11-10,
 * security review): the longest value an SMS is counted with, whether it
 * can be empty (no sender, no tracking yet), and whether it is text a
 * person typed, which may carry letters outside the GSM/TR table and send
 * the whole SMS as UCS-2.
 */
export interface TokenTraits {
  /** Stands in when an SMS is counted; none: the preview's own value. */
  longest?: string
  mayBeEmpty?: boolean
  freeText?: boolean
}

// A tracking or payment link as long as one gets: the carrier's query, the link's sealed token
const LONGEST_LINK = `https://${"x".repeat(112)}`

export const TOKEN_TRAITS: Readonly<Record<string, TokenTraits>> = {
  // personName() gives the greeting for a longer one (workflows/messaging/loaders/types.ts)
  müşteri_adı: { longest: LONGEST_NAME, freeText: true },
  alıcı_adı: { longest: LONGEST_NAME, freeText: true },
  gönderen_adı: { longest: LONGEST_NAME, freeText: true, mayBeEmpty: true },
  ürün_adı: { freeText: true },
  sipariş_no: { longest: "PL-9999999999" },
  toplam: { longest: "₺9.999.999,99" },
  takip_no: { longest: "9".repeat(24), mayBeEmpty: true },
  takip_bağlantısı: { longest: LONGEST_LINK, mayBeEmpty: true },
  ödeme_bağlantısı: { longest: LONGEST_LINK },
  kargo_firması: { longest: "Yurtiçi Kargo" },
  geçerlilik: { longest: "999 saat" },
  gün_sayısı: { longest: "999" },
}

/** The token's traits; a token not listed is filled from the shop's own settings. */
export const traitsOf = (token: string): TokenTraits =>
  Object.hasOwn(TOKEN_TRAITS, token) ? (TOKEN_TRAITS[token] ?? {}) : {}
