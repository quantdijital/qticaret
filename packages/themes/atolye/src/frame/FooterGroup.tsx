import type { ShopView, Translate } from "@qticaret/ui"
import { Blocks, type Subscribe } from "../sections/Blocks"

/**
 * The footer group's sections above the shop's footer, on every page but
 * the checkout's (adr/0070 §4, Shopify's footer group): a rich text, trust
 * badges, a scrolling strip, and under the free rows footer the newsletter
 * band, in the group's order, each drawn as on a page. None: nothing.
 */
export function FooterGroup({
  shop,
  t,
  subscribe,
}: {
  shop: ShopView
  t: Translate
  subscribe?: Subscribe | undefined
}) {
  const sections = shop.footerSections ?? []
  if (sections.length === 0) {
    return null
  }
  return (
    <div data-footer-group="">
      <Blocks sections={sections} t={t} subscribe={subscribe} />
    </div>
  )
}
