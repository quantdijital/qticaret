import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * The shop's own alerts by e-mail (F9.7, adr/0036): to the staff the
 * shop listed under Settings > Notifications, beside the panel's bell.
 * Transactional; nothing about a customer beyond what the order page has.
 */

export interface StaffOrderVars {
  number: string
  customer: string
  total: string
  payment: "card" | "bank_transfer" | "cash_on_delivery"
  items: number
}

export interface StaffStockVars {
  name: string
  available: number
  threshold: number
}

/** An invitation to the shop's panel: the link only the invitation knew. */
export interface StaffInviteVars {
  inviteUrl: string
  /** The role as the invitee reads it. */
  role: "admin" | "operations" | "readonly"
}

/** A staff member's 2FA turned on, off, or reset by the owner (Y13). */
export interface StaffMfaVars {
  change: "enabled" | "disabled" | "reset"
}

/** A contact message came, about what; who and what they wrote stay in the panel. */
export interface StaffContactVars {
  subject: "order" | "product" | "return" | "payment" | "kvkk" | "other"
  /** A KVKK request's last day to answer (30 days from its coming, adr/0041), in words. */
  due?: string | null
}

/** A staff member's password reset: the link only the event knew. */
export interface StaffResetVars {
  resetUrl: string
}

export interface StaffSeoVars {
  products: number
  average: number | null
  critical: number
  poor: number
  lowest: { title: string; score: number }[]
}

const FOOTER = (shop: string) => messageText("footer.staff", { shop })

/** "Yeni sipariş #1042": who, how much, how it is paid. */
export const staffNewOrder: MessageTemplate<StaffOrderVars> = {
  name: "staff.new_order",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_order.subject", { number: vars.number, total: vars.total }),
      preheader: messageText("staff_order.preheader", { customer: vars.customer }),
      heading: messageText("staff_order.heading", { number: vars.number }),
      blocks: [
        {
          kind: "summary",
          rows: [
            { label: messageText("staff.customer"), value: vars.customer },
            { label: messageText("staff.items"), value: String(vars.items) },
            {
              label: messageText("staff.payment"),
              value: messageText(`staff.payments.${vars.payment}`),
            },
            { label: messageText("order.total"), value: vars.total, strong: true },
          ],
        },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { number: "1042", customer: "Ayşe Yılmaz", total: "₺389,80", payment: "card", items: 3 },
}

/** "Havale bekleniyor": confirm the money in the panel when it comes. */
export const staffBankTransfer: MessageTemplate<StaffOrderVars> = {
  name: "staff.bank_transfer",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_transfer.subject", { number: vars.number, total: vars.total }),
      preheader: messageText("staff_transfer.preheader"),
      heading: messageText("staff_transfer.heading", { number: vars.number }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_transfer.intro", { customer: vars.customer, total: vars.total }),
        },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: {
    number: "1042",
    customer: "Ayşe Yılmaz",
    total: "₺389,80",
    payment: "bank_transfer",
    items: 3,
  },
}

/** "Stok azaldı": the same alert as the bell's. */
export const staffLowStock: MessageTemplate<StaffStockVars> = {
  name: "staff.low_stock",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_stock.subject", { name: vars.name }),
      preheader: messageText("staff_stock.preheader", { available: vars.available }),
      heading: messageText("staff_stock.heading", { name: vars.name }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_stock.intro", {
            available: vars.available,
            threshold: vars.threshold,
          }),
        },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { name: "Örnek ürün / Mavi M", available: 2, threshold: 5 },
}

/** "Yeni iletişim mesajı" (F18 D10, adr/0047): the bell's alert; the words stay in the panel. */
export const staffContactMessage: MessageTemplate<StaffContactVars> = {
  name: "staff.contact_message",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) => {
    const subject = messageText(`staff_contact.subjects.${vars.subject}`)
    return renderEmail(brand, {
      subject: messageText("staff_contact.subject", { subject }),
      preheader:
        vars.subject === "kvkk"
          ? messageText("staff_contact.kvkk_preheader", { due: vars.due ?? "" })
          : messageText("staff_contact.preheader"),
      heading: messageText("staff_contact.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_contact.intro", { subject }),
        },
        // A data request runs on the law's clock (KVKK md. 13, adr/0041)
        ...(vars.subject === "kvkk"
          ? [
              {
                kind: "paragraph" as const,
                text: messageText("staff_contact.kvkk_due", { due: vars.due ?? "" }),
              },
            ]
          : []),
      ],
      footer: FOOTER(brand.shopName),
    })
  },
  sample: { subject: "order" },
}

/** Monday's SEO summary: the shop's average score and what needs work first. */
export const staffSeoDigest: MessageTemplate<StaffSeoVars> = {
  name: "staff.seo_digest",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_seo.subject", {
        average: vars.average === null ? "—" : String(vars.average),
      }),
      preheader: messageText("staff_seo.preheader", { critical: vars.critical }),
      heading: messageText("staff_seo.heading"),
      blocks: [
        {
          kind: "summary",
          rows: [
            { label: messageText("staff_seo.products"), value: String(vars.products) },
            {
              label: messageText("staff_seo.average"),
              value: vars.average === null ? "—" : `${String(vars.average)}/100`,
              strong: true,
            },
            { label: messageText("staff_seo.critical"), value: String(vars.critical) },
            { label: messageText("staff_seo.poor"), value: String(vars.poor) },
          ],
        },
        ...(vars.lowest.length > 0
          ? [
              {
                kind: "details" as const,
                title: messageText("staff_seo.lowest"),
                lines: vars.lowest.map(({ title, score }) => `${title}: ${String(score)}/100`),
              },
            ]
          : []),
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: {
    products: 120,
    average: 74,
    critical: 6,
    poor: 9,
    lowest: [{ title: "Örnek ürün", score: 41 }],
  },
}

/** "Ekibe davet edildiniz": the panel's page that makes the account, good for a day (F12.6). */
export const staffInvite: MessageTemplate<StaffInviteVars> = {
  name: "staff.invite",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_invite.subject", { shop: brand.shopName }),
      preheader: messageText("staff_invite.preheader", { shop: brand.shopName }),
      heading: messageText("staff_invite.heading", { shop: brand.shopName }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("staff_invite.intro", {
            shop: brand.shopName,
            role: messageText(`staff_invite.roles.${vars.role}`),
          }),
        },
        { kind: "button", label: messageText("staff_invite.button"), url: vars.inviteUrl },
        { kind: "note", text: messageText("staff_invite.ignore") },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { inviteUrl: "https://magaza.example/invite#token=ornek", role: "operations" },
}

/** A staff member's password reset: the panel's page, good for 15 minutes (F12.6). */
export const staffPasswordReset: MessageTemplate<StaffResetVars> = {
  name: "staff.password_reset",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_reset.subject", { shop: brand.shopName }),
      preheader: messageText("staff_reset.preheader", { shop: brand.shopName }),
      heading: messageText("staff_reset.heading"),
      blocks: [
        { kind: "paragraph", text: messageText("staff_reset.intro", { shop: brand.shopName }) },
        { kind: "button", label: messageText("staff_reset.button"), url: vars.resetUrl },
        { kind: "note", text: messageText("staff_reset.ignore") },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { resetUrl: "https://magaza.example/reset-password#token=ornek" },
}

/**
 * "İki adımlı doğrulama kapatıldı": told to the member themself, so a
 * change they did not make (a stolen session, a password guessed) is
 * seen at once.
 */
export const staffMfaChanged: MessageTemplate<StaffMfaVars> = {
  name: "staff.mfa_changed",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText(`staff_mfa.subject.${vars.change}`, { shop: brand.shopName }),
      preheader: messageText(`staff_mfa.intro.${vars.change}`, { shop: brand.shopName }),
      heading: messageText("staff_mfa.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText(`staff_mfa.intro.${vars.change}`, { shop: brand.shopName }),
        },
        { kind: "note", text: messageText("staff_mfa.not_you") },
      ],
      footer: FOOTER(brand.shopName),
    }),
  sample: { change: "disabled" },
}
