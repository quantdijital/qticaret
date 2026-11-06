import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * A staff member's own account (the owner, 2026-11-06): the link that
 * confirms a new login address, and the notices that tell them their
 * password or address changed. Transactional, to the member alone.
 */

/** A new login address's confirmation: the link only the request knew. */
export interface StaffEmailConfirmVars {
  confirmUrl: string
}

/** What changed: the password, an address change asked, an address changed. */
export interface StaffAccountVars {
  change: "password" | "email_requested" | "email_changed"
  /** The new address, masked (`ye***@ornek.com`); for an address change only. */
  address: string | null
}

const FOOTER = (shop: string) => messageText("footer.staff_account", { shop })

/** "Yeni e-posta adresinizi onaylayın": to the new address, good for a day, once. */
export const staffEmailConfirm: MessageTemplate<StaffEmailConfirmVars> = {
  name: "staff.email_confirm",
  kind: "transactional",
  channels: ["email"],
  // The token is not kept: a failed send is asked again from the panel
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_email_confirm.subject", { shop: brand.shopName }),
      preheader: messageText("staff_email_confirm.preheader"),
      heading: messageText("staff_email_confirm.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_email_confirm.intro", { shop: brand.shopName }),
        },
        { kind: "button", label: messageText("staff_email_confirm.button"), url: vars.confirmUrl },
        { kind: "note", text: messageText("staff_email_confirm.ignore") },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { confirmUrl: "https://magaza.example/confirm-email#token=ornek" },
}

/** "Şifreniz değiştirildi" and the address notices: a change they did not make is seen at once. */
export const staffAccountChanged: MessageTemplate<StaffAccountVars> = {
  name: "staff.account_changed",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) => {
    const values = { shop: brand.shopName, address: vars.address ?? "" }
    return renderEmail(brand, {
      subject: messageText(`staff_account.subject.${vars.change}`, values),
      preheader: messageText(`staff_account.intro.${vars.change}`, values),
      heading: messageText("staff_account.heading"),
      blocks: [
        { kind: "paragraph", text: messageText(`staff_account.intro.${vars.change}`, values) },
        { kind: "note", text: messageText("staff_account.not_you") },
      ],
      footer: FOOTER(brand.shopName),
    })
  },
  sample: { change: "password", address: null },
}
