import type { NewsletterConsentStyle, StoreNewsletterSection } from "@qticaret/types"
import { newsletterHasNote, newsletterOnPage } from "@qticaret/types/section-newsletter"
import { variantOf } from "@qticaret/types/section-variants"
import type { NewsletterLookView, Translate } from "@qticaret/ui"
import { layoutImage } from "./layout"

/**
 * How a newsletter box is drawn (adr/0049 Ek 2026-11-17 e-bülten), its
 * words filled: the line beside the heading the shop's, else on the new
 * variants the storefront's (the standard box shows one only when
 * written, so a stored box draws as it did); the promise line on `split`
 * and `image_card` unless switched off; `image_card`'s picture (none: the
 * theme draws the card as `split`). A page's box never takes the footer
 * column variant (a newer or forged answer reads as `standard`).
 */
export function newsletterLookOf(
  section: Pick<
    StoreNewsletterSection,
    "variant" | "description" | "note" | "show_note" | "image" | "tone" | "consent_style"
  >,
  t: Translate,
  place: "page" | "footer"
): NewsletterLookView {
  const read = variantOf("newsletter", section.variant)
  const variant = place === "page" && !newsletterOnPage(read) ? "standard" : read
  return {
    variant,
    description:
      section.description ?? (variant === "standard" ? null : t("newsletter.description")),
    note:
      newsletterHasNote(variant) && section.show_note !== false
        ? (section.note ?? t("newsletter.note"))
        : null,
    // Beside the heading, which names the box: the picture's own alt text, else none
    image: variant === "image_card" && section.image ? layoutImage(section.image, "") : null,
    // The bands' wash of the main colour; a standard or column box has none
    tone:
      section.tone === "tint" && variant !== "standard" && variant !== "in_footer"
        ? "tint"
        : "plain",
    consentStyle: consentStyleOf(section),
  }
}

/** How the box asks for the consent; absent or unknown: the required box, as it was. */
export const consentStyleOf = (section: {
  consent_style?: NewsletterConsentStyle | undefined
}): NewsletterConsentStyle => (section.consent_style === "line" ? "line" : "box")

/**
 * The storefront's consent words when the shop wrote none: the box's
 * sentence, or the one small line saying that subscribing is consenting.
 */
export const consentWordsKey = (style: NewsletterConsentStyle): string =>
  style === "line" ? "newsletter.line" : "newsletter.text"
