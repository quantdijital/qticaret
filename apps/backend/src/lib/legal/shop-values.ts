import { readableTrPhone } from "../tr/phone"
import { legalDate, oneLine, siteAddress } from "./format"
import { workingDaysText } from "./shipping-days"
import type { ShopToken } from "./tokens"

/** The shop's details as stored: its identity, contact, site and policies (adr/0041 §1, §3). */
export interface ShopLegalFacts {
  store_name: string | null | undefined
  company_title: string | null
  mersis: string | null
  tax_office: string | null
  tax_number: string | null
  address: string | null
  kep: string | null
  etbis: string | null
  contact_email: string | null
  /** E.164 as the store details keep it. */
  contact_phone: string | null
  /** The storefront with its scheme (`https://www.magaza.com`); null when it has none yet. */
  storefront_url: string | null
  withdrawal_days: number
  handling_days: { min: number; max: number }
  transit_days: { min: number; max: number }
  today: Date
}

const text = (value: string | null | undefined): string | null => oneLine(value) || null

/**
 * The shop's tokens as its texts print them: the phone as a Turkish reader
 * writes it (`0534 255 11 45`), the site by its host (`www.magaza.com`,
 * no scheme), today in long form (`5 Kasım 2026`), the rest on one line as
 * the shop wrote it. A missing value stays null: the text shows a dash.
 */
export function shopTokenValues(facts: ShopLegalFacts): Record<ShopToken, string | null> {
  return {
    mağaza_adı: text(facts.store_name),
    mağaza_unvanı: text(facts.company_title),
    mersis: text(facts.mersis),
    vkn: text(facts.tax_number),
    vergi_dairesi: text(facts.tax_office),
    adres: text(facts.address),
    kep: text(facts.kep),
    etbis: text(facts.etbis),
    e_posta: text(facts.contact_email),
    telefon: readableTrPhone(facts.contact_phone),
    alan_adı: siteAddress(facts.storefront_url),
    iade_süresi: String(facts.withdrawal_days),
    hazırlama_süresi: workingDaysText(facts.handling_days.min, facts.handling_days.max),
    kargo_süresi: workingDaysText(facts.transit_days.min, facts.transit_days.max),
    bugün: legalDate(facts.today),
  }
}
