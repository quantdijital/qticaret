import { SHELF_STRIPS_DEFAULTS } from "@qticaret/types/section-strips"
import type { ShelfStripsSettings } from "@qticaret/types"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { badgesOf, isOut } from "../parts/card-parts"
import { shownOf } from "../parts/card-rows"
import { Strips } from "../parts/Strips"
import type { StripFlag, StripItem, StripsLook } from "../parts/Strips"
import { STRIPS_HEIGHT, STRIPS_SHAPE } from "../parts/strips-height"
import type { Of } from "./plan"

/** The strips' share of the screen from 1024 px (vw): the container's. */
const SPAN = 92

/** The rail's steps as the shared strips read them. */
export const shelfStripsLook = (settings: ShelfStripsSettings): StripsLook => ({
  slant: settings.strips_slant,
  line: settings.strips_line,
  overlap: settings.strips_overlap === "on",
  dim: settings.strips_dim === "on",
})

/**
 * A product's pill, as its compact card's (one at most, each as the shop
 * shows it): "Tükendi" on a sold-out product, else its discount ("%30",
 * the reader hears "%30 indirim").
 */
function flagOf(product: ProductCardView, t: Translate): StripFlag | null {
  const badges = badgesOf(product)
  if (isOut(product) && badges.soldOut) {
    return { tone: "out", text: t("product.out_of_stock") }
  }
  const percent = badges.sale ? (product.price?.discount ?? null) : null
  return percent === null
    ? null
    : {
        tone: "deal",
        text: t("product.discount_short", { percent }),
        label: t("product.discount", { percent }),
      }
}

/**
 * The line under a product's name: its price as the storefront formatted
 * it ("…'den başlayan" when its variants differ), one short line; a
 * sold-out product the shop shows no price for says "Tükendi" there
 * unless its pill already does.
 */
function noteOf(product: ProductCardView, t: Translate, flag: StripFlag | null): string | null {
  if (isOut(product) && shownOf(product).soldOutRow !== "price") {
    return flag?.tone === "out" ? null : t("product.out_of_stock")
  }
  const { price } = product
  return price ? (price.from ? t("price.from", { price: price.current }) : price.current) : null
}

/**
 * One product as a strip: its photograph (none: the strip's well), its
 * name and price over the foot, its pill on top, the whole strip one link
 * to its page. The photograph's `alt` is empty: the name drawn over it
 * names the link, which reads "name, price, pill" once.
 */
export function productStrip(product: ProductCardView, t: Translate): StripItem {
  const flag = flagOf(product, t)
  return {
    key: product.id,
    image: product.image ? { ...product.image, alt: "" } : null,
    href: product.path,
    title: product.title,
    note: noteOf(product, t, flag),
    flag,
  }
}

/**
 * `strips` (adr/0049 Ek 2026-11-16): the rail's products as upright
 * strips with slanted seams (`Strips`), the one under the pointer
 * widening, each the whole of it a link to its product. A storefront
 * view, not a card: no add button, quick view or favourite on a strip
 * (its page has them). A phone or tablet with more than it shows scrolls
 * them sideways, so no product is lost; every photograph loads lazily.
 */
export function StripsShelf({ section, t }: { section: Of<"products">; t: Translate }) {
  const settings = section.strips ?? SHELF_STRIPS_DEFAULTS
  return (
    <div className="gf-shelf-strips">
      <Strips
        items={section.products.map((product) => productStrip(product, t))}
        look={shelfStripsLook(settings)}
        max={8}
        span={SPAN}
        shape={STRIPS_SHAPE[settings.strips_height]}
        phone="scroll"
        className={STRIPS_HEIGHT[settings.strips_height]}
      />
    </div>
  )
}
