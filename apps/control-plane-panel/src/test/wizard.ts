import { emptyDraft } from "@/features/tenants/wizard/draft"
import type { ShopDraft } from "@/features/tenants/wizard/draft"

/** A new shop's draft every step of which can go on (made-up details: no one's). */
export function filledDraft(): ShopDraft {
  const draft = emptyDraft()
  return {
    ...draft,
    name: "Bıçak Atölyesi",
    company: {
      ...draft.company,
      legal_name: "Bıçak Atölyesi Ltd. Şti.",
      tax_number: "1234567890",
    },
    owner: { name: "Ayşe Demir", email: "ayse@bicakatolyesi.com", phone: "0532 123 45 67" },
    package_id: "pkg_pro",
  }
}
