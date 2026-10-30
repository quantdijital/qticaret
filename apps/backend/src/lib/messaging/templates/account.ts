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

/** An e-mail address to confirm: a link to the storefront's page, and the code it carries. */
export interface VerifyVars {
  code: string
  /** The storefront's confirmation page with the code; null until the shop has a domain. */
  verifyUrl: string | null
  /** When the code stops working, as the shopper reads it; null when not given. */
  expiresAt: string | null
}

/** "Şifrenizi yenileyin": the storefront's reset page, good for 15 minutes. */
export const passwordReset: MessageTemplate<ResetVars> = {
  name: "account.password_reset",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("password_reset.subject"),
      preheader: messageText("password_reset.preheader", { shop: brand.shopName }),
      heading: messageText("password_reset.heading"),
      blocks: [
        { kind: "paragraph", text: messageText("password_reset.intro", { shop: brand.shopName }) },
        { kind: "button", label: messageText("password_reset.button"), url: vars.resetUrl },
        { kind: "note", text: messageText("password_reset.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    }),
  sample: { resetUrl: "https://magaza.example/hesap/sifre-yenile?token=ornek" },
}

/** "E-posta adresinizi doğrulayın": the code Medusa made (auth.verification_requested). */
export const verifyEmail: MessageTemplate<VerifyVars> = {
  name: "account.verify_email",
  kind: "transactional",
  channels: ["email"],
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("verify_email.subject"),
      preheader: messageText("verify_email.preheader", { shop: brand.shopName }),
      heading: messageText("verify_email.heading"),
      blocks: [
        { kind: "paragraph", text: messageText("verify_email.intro", { shop: brand.shopName }) },
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
    }),
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
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("migration_invite.subject", { shop: brand.shopName }),
      preheader: messageText("migration_invite.preheader", { shop: brand.shopName }),
      heading: messageText("migration_invite.heading"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("migration_invite.intro", { shop: brand.shopName }),
        },
        { kind: "paragraph", text: messageText("migration_invite.orders") },
        { kind: "button", label: messageText("migration_invite.button"), url: vars.registerUrl },
        { kind: "note", text: messageText("migration_invite.password") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    }),
  sample: { registerUrl: "https://magaza.example/hesap/kayit?email=ornek%40example.com" },
}
