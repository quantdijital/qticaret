import type { NewsletterVariant } from "@qticaret/types"
import type { ImageView } from "./views"

/**
 * How a newsletter box is drawn (adr/0049 Ek 2026-11-17 e-bülten), on a
 * page or in the footer, its words filled by the storefront: the shop's
 * own or the storefront's. Absent (an older storefront): `standard`, no
 * line, no promise, no picture. A theme draws a variant it lacks as
 * `standard` (`drawnVariant`).
 */
export interface NewsletterLookView {
  variant: NewsletterVariant
  /** The line beside the heading; null: none (the standard box without one written). */
  description: string | null
  /** `split`, `image_card`: the small promise line; null: hidden. */
  note: string | null
  /** `image_card`: the picture; null: the card drawn as `split`. */
  image: ImageView | null
}
