import type { TenantDetail } from "./api"

export type Gap = "company" | "billingContact" | "package"

/** What the shop's record still lacks for its invoice and reminders. */
export function gapsOf(shop: TenantDetail): { gaps: Gap[]; companyFields: string[] } {
  const company = shop.company
  const sole = company?.kind === "sole_proprietor"
  const wanted: [string, string | null | undefined][] = [
    ["legalName", company?.legal_name],
    ["taxOffice", company?.tax_office],
    sole ? ["tckn", company.tckn_masked] : ["taxNumber", company?.tax_number],
    ["addressLine", company?.address_line],
    ["city", company?.city],
  ]
  const companyFields = wanted.filter(([, value]) => !value).map(([field]) => field)
  const gaps: Gap[] = []
  if (companyFields.length > 0) {
    gaps.push("company")
  }
  if (!shop.contacts.some((contact) => contact.is_primary_billing)) {
    gaps.push("billingContact")
  }
  if (!shop.package) {
    gaps.push("package")
  }
  return { gaps, companyFields }
}
