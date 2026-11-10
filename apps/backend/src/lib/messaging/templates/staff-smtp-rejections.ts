import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * The shop's own mail server refusing too many recipients (adr/0036 Ek
 * 2026-11-10, security review M2), to the staff list beside the bell: most
 * likely its own setting, so its refusals stopped being suppressed. It may
 * not arrive through that same server; the bell always does.
 */
export interface StaffSmtpRejectionsVars {
  rejections: string
  sends: string
  minutes: string
}

export const staffSmtpRejections: MessageTemplate<StaffSmtpRejectionsVars> = {
  name: "staff.smtp_rejections",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_smtp_rejections.subject", { shop: brand.shopName }),
      preheader: messageText("staff_smtp_rejections.preheader", { ...vars }),
      heading: messageText("staff_smtp_rejections.heading"),
      blocks: [
        { kind: "paragraph", text: messageText("staff_smtp_rejections.intro", { ...vars }) },
        { kind: "note", text: messageText("staff_smtp_rejections.next") },
      ],
      footer: messageText("footer.staff", { shop: brand.shopName }),
    }),
  sample: { rejections: "12", sends: "15", minutes: "10" },
}
