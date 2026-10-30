import { ValidationError } from "../../errors"
import { readSheet } from "../../sheets"
import type { MigrationSource, SourceAddress, SourceCustomer } from "../types"

/**
 * The old platform's customer list as a sheet (F14.3, adr/0042 §5): xlsx
 * or CSV, the header read loosely so a platform's own export fits (Ticimax,
 * ikas, IdeaSoft and T-Soft name their columns alike: "E-Posta", "Adı",
 * "Cep Telefonu", "İl"). Customers are keyed by their address, so a list
 * sent again moves nobody twice. A consent column counts only with the
 * date it was given (adr/0042 §5): "Evet" alone is no consent.
 */

export const CUSTOMER_SHEET_LIMITS = { maxRows: 200_000, maxCells: 60 } as const

type Field =
  | "email"
  | "first_name"
  | "last_name"
  | "full_name"
  | "phone"
  | "company"
  | "province"
  | "city"
  | "address_1"
  | "postal_code"
  | "email_consent"
  | "sms_consent"
  | "created_at"

// A header as compared: lower case, Turkish letters plain, no spaces or marks
const keyOf = (text: string) =>
  text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")

const ALIASES: Readonly<Record<Field, readonly string[]>> = {
  email: ["eposta", "email", "epostaadresi", "emailadresi", "mail", "mailadresi"],
  first_name: ["ad", "adi", "isim", "firstname", "uyeadi"],
  last_name: ["soyad", "soyadi", "lastname", "uyesoyadi"],
  full_name: ["adsoyad", "adisoyadi", "musteriadi", "musteri", "name", "fullname"],
  phone: ["telefon", "ceptelefonu", "gsm", "telefonnumarasi", "phone", "cep", "mobil"],
  company: ["firma", "sirket", "firmaadi", "company"],
  province: ["il", "sehir", "province"],
  city: ["ilce", "district", "city"],
  address_1: ["adres", "acikadres", "address", "teslimatadresi"],
  postal_code: ["postakodu", "zip", "zipcode", "postcode"],
  email_consent: ["epostaizni", "epostaizintarihi", "emailizni", "emailizintarihi", "epostaonayi"],
  sms_consent: ["smsizni", "smsizintarihi", "smsonayi"],
  created_at: ["kayittarihi", "uyeliktarihi", "createdat", "olusturmatarihi"],
}

/** A consent's or a sign-up's date: ISO, or "31.12.2024" (a time after it kept). */
function dateOf(text: string | undefined): Date | null {
  const value = (text ?? "").trim()
  const turkish = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(value)
  const parsed = turkish
    ? new Date(
        Date.UTC(
          Number(turkish[3]),
          Number(turkish[2]) - 1,
          Number(turkish[1]),
          Number(turkish[4] ?? 12) - 3,
          Number(turkish[5] ?? 0)
        )
      )
    : /^\d{4}-\d{2}-\d{2}/.test(value)
      ? new Date(value)
      : null
  return parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() ? parsed : null
}

const cut = (text: string | undefined, max: number): string | null => {
  const value = (text ?? "").trim()
  return value === "" ? null : value.slice(0, max)
}

/** The sheet's customers: one per address, the last row for an address standing. */
export async function sheetCustomers(bytes: Buffer): Promise<SourceCustomer[]> {
  const read = await readSheet(bytes, CUSTOMER_SHEET_LIMITS)
  if (!read.ok) {
    throw new ValidationError("migration.customers_sheet_invalid")
  }
  const columns = new Map<Field, number>()
  read.header.forEach((name, index) => {
    const key = keyOf(name)
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, readonly string[]][]) {
      if (aliases.includes(key) && !columns.has(field)) {
        columns.set(field, index)
      }
    }
  })
  if (!columns.has("email")) {
    throw new ValidationError("migration.customers_sheet_invalid")
  }
  const customers = new Map<string, SourceCustomer>()
  for (const row of read.rows) {
    const cell = (field: Field) => {
      const index = columns.get(field)
      return index === undefined ? undefined : row.cells[index]
    }
    const email = cut(cell("email"), 320)
    if (!email) {
      continue
    }
    const full = cut(cell("full_name"), 255)?.split(/\s+/) ?? []
    const first =
      cut(cell("first_name"), 255) ??
      (full.length > 1 ? full.slice(0, -1).join(" ") : (full[0] ?? null))
    const last = cut(cell("last_name"), 255) ?? (full.length > 1 ? (full.at(-1) ?? null) : null)
    const address: SourceAddress = {
      first_name: first,
      last_name: last,
      company: cut(cell("company"), 255),
      address_1: cut(cell("address_1"), 500),
      address_2: null,
      city: cut(cell("city"), 255),
      province: cut(cell("province"), 255),
      postal_code: cut(cell("postal_code"), 20),
      phone: cut(cell("phone"), 32),
    }
    const emailConsent = dateOf(cell("email_consent"))
    const smsConsent = dateOf(cell("sms_consent"))
    customers.set(email.toLowerCase(), {
      source_key: email.toLowerCase(),
      email,
      first_name: first,
      last_name: last,
      phone: address.phone,
      addresses: address.address_1 ? [address] : [],
      marketing: emailConsent || smsConsent ? { email: emailConsent, sms: smsConsent } : null,
      created_at: dateOf(cell("created_at")),
    })
  }
  return [...customers.values()]
}

/** A customer sheet as a migration source: customers only. */
export async function customerSheetSource(bytes: Buffer): Promise<MigrationSource> {
  const customers = await sheetCustomers(bytes)
  const listOf =
    <T>(items: readonly T[]) =>
    (): AsyncIterable<T> => ({
      [Symbol.asyncIterator]: () => {
        const each = items.values()
        return { next: () => Promise.resolve(each.next()) }
      },
    })
  return {
    id: "customer-sheet",
    categories: listOf([]),
    brands: listOf([]),
    products: listOf([]),
    customers: listOf(customers),
    orders: listOf([]),
    reviews: listOf([]),
    pages: listOf([]),
  }
}
