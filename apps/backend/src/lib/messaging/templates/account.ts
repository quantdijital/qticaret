import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A password reset: the link only the event knew, so a failed send is not tried again. */
export interface ResetVars {
  resetUrl: string
}

/** Moved from the shop's old platform (F14.5): the storefront's sign-up page, the address filled in. */
export interface MigrationInviteVars {
  registerUrl: string
}

/** A wholesaler invited (ADR-0068 §3): the storefront's sign-up page, and when the invitation ends. */
export interface WholesaleInviteVars {
  registerUrl: string
  /** The day it ends, as the reader reads it ("13 Şubat 2027"). */
  expiresAt: string
}

/** A customer's wholesale account opened (ADR-0068 §3): the storefront's sign-in page. */
export interface WholesaleEnabledVars {
  loginUrl: string
}

/** An e-mail address to confirm: a link to the storefront's page, and the code it carries. */
export interface VerifyVars {
  code: string
  /** The storefront's confirmation page with the code; null until the shop has a domain. */
  verifyUrl: string | null
  /** When the code stops working, as the shopper reads it; null when not given. */
  expiresAt: string | null
}

/**
 * What the shop may reword in an account message (adr/0036 Ek 2026-11-10):
 * its name the one value. A reset and an address check are required: the
 * account cannot work without them.
 */
const accountSpec = <V>(key: string, required: boolean): EditSpec<V> => ({
  group: "account",
  required,
  tokens: { mağaza_adı: "shop" },
  fields: {
    subject: `${key}.subject`,
    preheader: `${key}.preheader`,
    heading: `${key}.heading`,
    intro: `${key}.intro`,
  },
  values: (_vars, brand) => ({ shop: brand.shopName }),
})

const RESET = accountSpec<ResetVars>("password_reset", true)
const VERIFY = accountSpec<VerifyVars>("verify_email", true)
const MIGRATION = accountSpec<MigrationInviteVars>("migration_invite", false)
const WHOLESALE_INVITE = accountSpec<WholesaleInviteVars>("wholesale_invite", false)
const WHOLESALE_ENABLED = accountSpec<WholesaleEnabledVars>("wholesale_enabled", false)

/** "Şifrenizi yenileyin": the storefront's reset page, good for 15 minutes. */
export const passwordReset: MessageTemplate<ResetVars> = {
  name: "account.password_reset",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  editable: RESET,
  email: (vars, brand, context) => {
    const text = textsFor(RESET, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "button", label: messageText("password_reset.button"), url: vars.resetUrl },
        { kind: "note", text: messageText("password_reset.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: { resetUrl: "https://magaza.example/hesap/sifre-yenile?token=ornek" },
}

/** "E-posta adresinizi doğrulayın": the code Medusa made (auth.verification_requested). */
export const verifyEmail: MessageTemplate<VerifyVars> = {
  name: "account.verify_email",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  editable: VERIFY,
  email: (vars, brand, context) => {
    const text = textsFor(VERIFY, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        ...(vars.verifyUrl
          ? [
              {
                kind: "button" as const,
                label: messageText("verify_email.button"),
                url: vars.verifyUrl,
              },
            ]
          : []),
        {
          kind: "details",
          title: messageText("verify_email.code_title"),
          lines: [messageText("verify_email.code_hint"), vars.code],
        },
        ...(vars.expiresAt
          ? [
              {
                kind: "note" as const,
                text: messageText("verify_email.expires", { at: vars.expiresAt }),
              },
            ]
          : []),
        { kind: "note", text: messageText("verify_email.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: {
    code: "OrnekDogrulamaKodu",
    verifyUrl: "https://magaza.example/hesap/dogrula?code=OrnekDogrulamaKodu",
    expiresAt: "28 Ekim 2026 18:15",
  },
}

/**
 * "Hesabınızı yeni mağazada açın" (F14.5, adr/0042 §6): a customer moved
 * from the shop's old platform, whose password could not move, asked to
 * open their account here. Nothing of an offer in it: it is about their
 * account and their earlier orders, so it goes as a transactional message.
 */
export const migrationInvite: MessageTemplate<MigrationInviteVars> = {
  name: "account.migration_invite",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: MIGRATION,
  email: (vars, brand, context) => {
    const text = textsFor(MIGRATION, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "paragraph", text: messageText("migration_invite.orders") },
        { kind: "button", label: messageText("migration_invite.button"), url: vars.registerUrl },
        { kind: "note", text: messageText("migration_invite.password") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: { registerUrl: "https://magaza.example/hesap/kayit?email=ornek%40example.com" },
}

/**
 * "Toptan hesabınız hazır" (ADR-0068 §3): the shop opened a wholesale
 * account for an address with no account yet. Signing up there with the
 * same address takes it; no password is set for them. About their
 * account, not an offer: a transactional message, counted in the
 * transactional day (an order's mail is never held back by it).
 */
export const wholesaleInvite: MessageTemplate<WholesaleInviteVars> = {
  name: "account.wholesale_invite",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: WHOLESALE_INVITE,
  email: (vars, brand, context) => {
    const text = textsFor(WHOLESALE_INVITE, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "paragraph", text: messageText("wholesale_invite.same_email") },
        { kind: "button", label: messageText("wholesale_invite.button"), url: vars.registerUrl },
        { kind: "note", text: messageText("wholesale_invite.expires", { at: vars.expiresAt }) },
        { kind: "note", text: messageText("wholesale_invite.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: { registerUrl: "https://magaza.example/hesap/kayit", expiresAt: "13 Şubat 2027" },
}

/** "Toptan hesabınız açıldı" (ADR-0068 §3): an existing customer made a wholesaler. */
export const wholesaleEnabled: MessageTemplate<WholesaleEnabledVars> = {
  name: "account.wholesale_enabled",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: WHOLESALE_ENABLED,
  email: (vars, brand, context) => {
    const text = textsFor(WHOLESALE_ENABLED, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "button", label: messageText("wholesale_enabled.button"), url: vars.loginUrl },
        { kind: "note", text: messageText("wholesale_enabled.note") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    })
  },
  sample: { loginUrl: "https://magaza.example/hesap/giris" },
}
