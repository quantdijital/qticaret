import { fillShopText } from "@/features/settings/shop-tokens"
import type { ShopTokenValues } from "@/features/settings/shop-tokens"

/**
 * A bulk text's length as the backend counts it (`lib/campaigns/sms.ts`,
 * adr/0050 §4), so the panel shows the parts while it is typed. Netgsm
 * sends with the Turkish single shift table: 155 characters for one part,
 * 149 for each part of a longer text; ş Ş ğ Ğ ı İ ç and the GSM extension
 * characters take two. Anything outside both goes as UCS-2: 70, then 67 a
 * part. The server counts again on save and refuses past three parts.
 */

export const SMS_MAX_PARTS = 3

/** `{ad}` stands for this when the recipient has no name; the longest, so the count is safe. */
export const GREETING = "Değerli müşterimiz"

const GSM_BASIC = new Set(
  [
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?",
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ].join("")
)
const GSM_DOUBLE = new Set(Array.from("^{}\\[~]|€şŞğĞıİç"))

export interface SmsLength {
  encoding: "gsm" | "ucs2"
  /** Septets (GSM) or UTF-16 units (UCS-2). */
  units: number
  parts: number
  /** What one part holds in this encoding, for "N / 155". */
  perPart: number
}

const partsOf = (units: number, single: number, each: number): number =>
  units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / each)

export function smsLength(text: string): SmsLength {
  let septets = 0
  for (const char of text) {
    if (GSM_BASIC.has(char)) {
      septets += 1
    } else if (GSM_DOUBLE.has(char)) {
      septets += 2
    } else {
      const units = text.length
      const parts = partsOf(units, 70, 67)
      return { encoding: "ucs2", units, parts, perPart: parts > 1 ? 67 : 70 }
    }
  }
  const parts = partsOf(septets, 155, 149)
  return { encoding: "gsm", units: septets, parts, perPart: parts > 1 ? 149 : 155 }
}

const sentence = (text: string): string => {
  const trimmed = text.trim()
  return trimmed === "" || /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** The fixed end of every bulk text: the shop's name and the way to refuse (6563). */
export const smsFooter = (shopName: string, optOut: string): string =>
  [sentence(shopName), optOut.trim()].filter((part) => part !== "").join(" ")

/** The text as it goes: what the shop wrote, then the footer. */
export function composeSms(text: string, shopName: string, optOut: string): string {
  return [sentence(text), smsFooter(shopName, optOut)].filter((part) => part !== "").join(" ")
}

const NAME = /\{ad\}/gu

/**
 * The text as a recipient would get it: the shop's details in place, the
 * greeting for `{ad}`, the footer after. What the parts are counted on.
 */
export function smsAsSent(
  text: string,
  values: ShopTokenValues,
  shopName: string,
  optOut: string
): string {
  const filled = fillShopText(text, values).replace(NAME, () => GREETING)
  return composeSms(filled, shopName, optOut)
}
