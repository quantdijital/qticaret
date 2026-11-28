import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * The platform's support opened a session in the panel (adr/0061 Ek
 * "Destek erişimi", Karar 6), to each owner's own login beside the bell:
 * who, why and until when, and where to end or turn it off. A session the
 * owner did not expect is seen at once.
 */
export interface StaffSupportAccessVars {
  operator: string
  reason: string
  /** Its end, as the shop reads the time (Europe/Istanbul, "14:35"). */
  ends_at: string
}

export const staffSupportAccess: MessageTemplate<StaffSupportAccessVars> = {
  name: "staff.support_access",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_support.subject", { shop: brand.shopName }),
      preheader: messageText("staff_support.intro", { ...vars, shop: brand.shopName }),
      heading: messageText("staff_support.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_support.intro", { ...vars, shop: brand.shopName }),
        },
        { kind: "paragraph", text: messageText("staff_support.reason", { ...vars }) },
        { kind: "note", text: messageText("staff_support.not_wanted") },
      ],
      footer: messageText("footer.staff", { shop: brand.shopName }),
    }),
  sample: {
    operator: "Ayşe Yılmaz",
    reason: "Ana sayfa görünümünü ve ilk ürünleri birlikte hazırlamak için",
    ends_at: "14:35",
  },
}
