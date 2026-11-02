/**
 * The shop's details a text spells out instead of naming them as
 * `{telefon}`, `{e_posta}` or `{whatsapp}` (adr/0048): such a copy goes
 * stale when the store details change. The SEO advisor points them out.
 */
export type WrittenDetail = "telefon" | "whatsapp" | "e_posta"

export interface ShopContact {
  /** E.164. */
  phone: string | null
  whatsapp: string | null
  email: string | null
}

// The national number's ten digits with any spacing a person types between them,
// after a trunk `0` or `+90` if there is one, and no other digit around it
const phonePattern = (e164: string): RegExp | null => {
  const digits = e164.replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) {
    return null
  }
  const spaced = digits.split("").join("[\\s().-]*")
  return new RegExp(`(?<!\\d)(?:\\+?90[\\s().-]*|0[\\s().-]*)?${spaced}(?!\\d)`)
}

export function writtenDetails(text: string, contact: ShopContact): WrittenDetail[] {
  const found: WrittenDetail[] = []
  const phone = contact.phone ? phonePattern(contact.phone) : null
  if (phone?.test(text)) {
    found.push("telefon")
  }
  const whatsapp = contact.whatsapp ? phonePattern(contact.whatsapp) : null
  if (whatsapp && contact.whatsapp !== contact.phone && whatsapp.test(text)) {
    found.push("whatsapp")
  }
  if (contact.email && text.toLocaleLowerCase("tr").includes(contact.email.toLowerCase())) {
    found.push("e_posta")
  }
  return found
}
