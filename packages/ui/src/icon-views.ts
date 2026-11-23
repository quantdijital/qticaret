import type { CategoryIconsStep, SectionIcon } from "@qticaret/types"
import type { ImageView, LinkView } from "./views"

/**
 * The categories' icon row as a theme draws it (`icons`, adr/0077 §10 Ek):
 * the categories in the section's order, each a round disc holding the icon
 * the shop picked for it, else the category's own picture, else its name's
 * first letter; its name under the disc and, while the shop shows counts,
 * how many products it lists. `disc` and `phone` are the settings as the
 * contract reads them (`categoryIconsSettingsOf`).
 */
export interface CategoryIconsView {
  disc: CategoryIconsStep<"disc">
  phone: CategoryIconsStep<"phone">
  items: CategoryIconView[]
}

export interface CategoryIconView extends LinkView {
  /** The shop's pick for this category; none: its picture, else its initial. */
  icon: SectionIcon | null
  /** The category's own picture (never a product's); none: its initial. */
  image: ImageView | null
  /** Its name's first letter, upper-cased for Turkish ("İ" from "i"). */
  initial: string
  count?: number | null
}
