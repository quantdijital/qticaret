import type { Translate } from "@qticaret/ui"
import { newsletterWords } from "./newsletter-words"
import type { NewsletterWords } from "./newsletter-words"

export interface PopupWords {
  close: string
  /** The code's name beside it, read with it. */
  code: string
  copy: string
  copied: string
  /** Neither clipboard took it: the code is selected for the visitor to copy. */
  copyFailed: string
  /** An automatic promotion: no code to copy. */
  automatic: string
  /** The newsletter pop-up's form, the footer box's words and consent sentence. */
  newsletter: NewsletterWords
}

/**
 * The pop-up's words (adr/0080 §6), translated once for the layout, never
 * per pop-up: the newsletter form's are the footer box's own, its consent
 * sentence the one the shop shows there (the same proof, `bulten-1`).
 */
export const popupWords = (t: Translate, consent: string): PopupWords => ({
  close: t("popup.close"),
  code: t("popup.code"),
  copy: t("popup.copy"),
  copied: t("popup.copied"),
  copyFailed: t("popup.copy_failed"),
  automatic: t("popup.automatic"),
  newsletter: newsletterWords(t, consent),
})
