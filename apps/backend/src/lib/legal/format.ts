import { formatLira } from "../money/format"
import { fromMedusaAmount } from "../money/medusa"
import type { MedusaAmount } from "../money/medusa"
import { trMatchKey } from "../tr/text"

/**
 * How the legal texts write a value (adr/0041 §1): as a Turkish reader
 * reads it in a contract, never as it is stored. Phones go through
 * `readableTrPhone` (`lib/tr/phone.ts`).
 */

const ZONE = "Europe/Istanbul"
const DATE = new Intl.DateTimeFormat("tr-TR", { timeZone: ZONE, dateStyle: "long" })
const DATE_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ZONE,
  dateStyle: "long",
  timeStyle: "short",
})

/** A day in Turkish long form, Istanbul's: `5 Kasım 2026`. */
export const legalDate = (date: Date): string => DATE.format(date)

/** A moment in Turkish long form, Istanbul's: `30 Ekim 2026 12:15`. */
export const legalDateTime = (date: Date): string => DATE_TIME.format(date)

const liraOf = (amount: MedusaAmount): number =>
  fromMedusaAmount(amount, { allowRounding: true }) / 100

/** A Medusa amount (lira) as prices are written: `1.500,00 TL`. */
export const legalMoney = (amount: MedusaAmount): string => formatLira(liraOf(amount))

/** A discount taken off the total, with the storefront's minus: `−50,00 TL`; none, `0,00 TL`. */
export function legalDiscount(amount: MedusaAmount): string {
  const lira = Math.abs(liraOf(amount))
  return lira > 0 ? `−${formatLira(lira)}` : formatLira(0)
}

/** Text on one line: runs of spaces, tabs and line breaks as one space, trimmed. */
export const oneLine = (text: string | null | undefined): string =>
  text?.replace(/\s+/gu, " ").trim() ?? ""

/** The parts that have something, each on one line, joined. */
export const joined = (parts: readonly (string | null | undefined)[], separator: string): string =>
  parts
    .map(oneLine)
    .filter((part) => part !== "")
    .join(separator)

export type AddressFacts = Partial<
  Record<
    | "first_name"
    | "last_name"
    | "company"
    | "address_1"
    | "address_2"
    | "city"
    | "province"
    | "postal_code"
    | "phone",
    string | null
  >
>

/**
 * An address in one line, the way an envelope reads (company,
 * neighbourhood, street, then the postal code before district and
 * province): `Moda Mah., Atatürk Cad. No: 5, 34710 Kadıköy / İstanbul`.
 * A district named as its province is written once.
 */
export function addressLine(address: AddressFacts | null | undefined): string {
  if (!address) {
    return ""
  }
  const district = oneLine(address.city)
  const province = oneLine(address.province)
  const place =
    district !== "" && trMatchKey(district) === trMatchKey(province)
      ? province
      : joined([district, province], " / ")
  return joined(
    [
      address.company,
      address.address_2,
      address.address_1,
      joined([address.postal_code, place], " "),
    ],
    ", "
  )
}

/**
 * The site as a text names it: its host alone, never a scheme, a path or
 * a trailing slash (`https://www.magaza.com/` → `www.magaza.com`).
 */
export function siteAddress(url: string | null | undefined): string | null {
  if (!url) {
    return null
  }
  try {
    return new URL(url).host.replace(/\.$/u, "") || null
  } catch {
    return null
  }
}
