import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A consent request's confirmation: what it records, and its link. */
export interface ConsentConfirmVars {
  /** Consent given (true) or withdrawn (false). */
  granting: boolean
  /** The backend's page that asks, then records it; null without the backend's address. */
  confirmUrl: string | null
}

const SAMPLE: ConsentConfirmVars = {
  granting: true,
  confirmUrl: "https://magaza.example/abonelik/onay?t=ornek",
}

/**
 * "İzninizi onaylayın" (security review 2026-10-29): campaign messages to
 * an address only once its owner confirms them from it, so no one can
 * sign a stranger up, nor withdraw a stranger's consent.
 */
export const consentConfirm: MessageTemplate<ConsentConfirmVars> = {
  name: "consent.confirm",
  kind: "transactional",
  channels: ["email", "sms"],
  // The link's token is only the request's: a lost one is asked for again
  retry: false,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText(vars.granting ? "consent_confirm.subject" : "consent_revoke.subject"),
      preheader: messageText("consent_confirm.preheader", { shop: brand.shopName }),
      heading: messageText(vars.granting ? "consent_confirm.subject" : "consent_revoke.subject"),
      blocks: [
        {
          kind: "paragraph",
          text: messageText(vars.granting ? "consent_confirm.intro" : "consent_revoke.intro", {
            shop: brand.shopName,
          }),
        },
        {
          kind: "button",
          label: messageText(vars.granting ? "consent_confirm.button" : "consent_revoke.button"),
          url: vars.confirmUrl,
        },
        { kind: "note", text: messageText("consent_confirm.ignore") },
      ],
      footer: messageText("footer.account", { shop: brand.shopName }),
    }),
  sms: (vars, brand) =>
    messageText(vars.granting ? "consent_confirm.sms" : "consent_revoke.sms", {
      shop: brand.shopName,
      url: vars.confirmUrl ?? "",
    }),
  sample: SAMPLE,
}
