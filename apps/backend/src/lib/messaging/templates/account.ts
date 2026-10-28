import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A password reset: the link only the event knew, so a failed send is not tried again. */
export interface ResetVars {
  resetUrl: string
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
