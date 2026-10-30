/**
 * Whether the shop's legal identity is complete (F13.9, adr/0041 §3): what
 * a web shop must show its customers. MERSİS, KEP and ETBİS are asked for
 * but not required: a sole trader may have none of them.
 */

export const IDENTITY_FIELDS = [
  "company_title",
  "address",
  "tax_office",
  "tax_number",
  "contact",
] as const
export type IdentityField = (typeof IDENTITY_FIELDS)[number]

export interface IdentityFacts {
  company_title: string | null
  address: string | null
  tax_office: string | null
  tax_number: string | null
  contact_email: string | null
  contact_phone: string | null
}

/** The required details still missing, in the order a form asks them. */
export function identityGaps(facts: IdentityFacts): IdentityField[] {
  const has = (value: string | null) => value !== null && value.trim() !== ""
  return IDENTITY_FIELDS.filter((field) =>
    field === "contact"
      ? !has(facts.contact_email) && !has(facts.contact_phone)
      : !has(facts[field])
  )
}
