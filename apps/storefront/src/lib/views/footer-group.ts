import "server-only"
import type { StoreFooterSection, StoreLayout } from "@qticaret/types"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { variantOf } from "@qticaret/types/section-variants"
import { sectionViews } from "./sections"

/**
 * The footer group's sections the theme draws above the shop's footer, in
 * the group's order, as a page's sections (adr/0070 §4): a rich text, trust
 * badges, a scrolling strip. The newsletter box joins them only under the
 * free rows footer, as a band drawn its own way (`standard`, `split`,
 * `image_card`, `strip`), unless the shop set its band on the footer's
 * ground (`joined`, adr/0070 §4 Ek: the free rows footer draws it as its
 * top band); the ledger and the brand columns draw it inside the footer as
 * today (`ShopView.newsletter`), and an `in_footer` box has a column
 * there, never a band. Nothing to draw: no request.
 */
export async function footerSectionsOf(
  layout: StoreLayout,
  t: Translate
): Promise<HomeSectionView[]> {
  const free = variantOf("footer_bar", layout.main?.footer_bar.variant) === "free_rows"
  const drawn = layout.footer.filter((section) => drawnAbove(section, free))
  return drawn.length > 0 ? sectionViews(drawn, t) : []
}

function drawnAbove(section: StoreFooterSection, free: boolean): boolean {
  if (section.type !== "newsletter") {
    return true
  }
  return free && variantOf("newsletter", section.variant) !== "in_footer" && !joinedBand(section)
}

/** The box's band drawn on the free rows footer's ground (adr/0070 §4 Ek): a band variant set so. */
export const joinedBand = (section: Extract<StoreFooterSection, { type: "newsletter" }>) =>
  section.joined === true && JOINED_VARIANTS.includes(variantOf("newsletter", section.variant))

const JOINED_VARIANTS: readonly string[] = ["split", "image_card", "strip"]

/** The footer group's newsletter box, wherever it stands in the group; none: the shop took it out. */
export const footerNewsletterOf = (layout: StoreLayout) =>
  layout.footer.find(
    (section): section is Extract<StoreFooterSection, { type: "newsletter" }> =>
      section.type === "newsletter"
  )
