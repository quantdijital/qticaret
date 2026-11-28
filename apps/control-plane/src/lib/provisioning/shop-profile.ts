import type { TenantProfile } from "@qticaret/types/control-plane"
import type { CompanyRecord, ContactRecord } from "../../modules/tenants/types"

/**
 * What the shop's settings take from its record at setup (audit 1.3):
 * the company's title, tax office, VKN and address into its legal
 * section, the owner's e-mail and phone into its store section, so the
 * owner does not type them again. Never a TCKN: a sole trader's number is
 * sealed here and stays here (adr/0061 §4.4); only a company's VKN goes.
 * Null when there is nothing to hand over.
 */

const VKN = /^\d{10}$/

const filled = (value: string | null | undefined): string | undefined => {
  const text = value?.trim() ?? ""
  return text === "" ? undefined : text
}

/** "Moda Cad. No:1, 34710 Kadıköy/İstanbul": the pieces there are, in the usual order. */
export function addressLine(company: CompanyRecord): string | undefined {
  const place = [filled(company.district), filled(company.city)].filter(Boolean).join("/")
  const tail = [filled(company.postal_code), place].filter(Boolean).join(" ")
  return filled([filled(company.address_line), tail].filter(Boolean).join(", "))
}

/** Only the fields given: the shop fills each where it has nothing. */
const given = <T extends Record<string, string | undefined>>(fields: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as Partial<T>

export function profileOf(
  company: CompanyRecord | null,
  contacts: readonly ContactRecord[]
): TenantProfile | null {
  const vkn =
    company?.kind === "company" && VKN.test(company.tax_number ?? "")
      ? (company.tax_number ?? undefined)
      : undefined
  const legal = given({
    company_title: filled(company?.legal_name)?.slice(0, 200),
    tax_office: filled(company?.tax_office)?.slice(0, 100),
    tax_number: vkn,
    address: company ? addressLine(company)?.slice(0, 500) : undefined,
  })
  const owner = contacts.find((contact) => contact.role === "owner") ?? contacts[0]
  const store = given({
    contact_email: filled(owner?.email),
    contact_phone: filled(owner?.phone),
  })
  if (Object.keys(legal).length === 0 && Object.keys(store).length === 0) {
    return null
  }
  return { legal, store }
}
