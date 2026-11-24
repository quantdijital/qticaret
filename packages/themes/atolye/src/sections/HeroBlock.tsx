import { drawnVariant } from "@qticaret/ui"
import type { ProductCardView, Translate } from "@qticaret/ui"
import { Hero } from "./Hero"
import { HERO_VARIANTS, HeroCatalog } from "./HeroCatalog"
import { HeroFull } from "./HeroFull"
import type { Of } from "./plan"

/**
 * The opening in the variant the shop chose (`drawnVariant`): H17 or the
 * full image (adr/0077 §9) when its parts came with it; else today's
 * opening, as for a variant this theme does not draw.
 */
export function HeroBlock({
  section,
  product,
  first,
  t,
}: {
  section: Of<"hero">
  /** The shop's newest pictured product, for an opening without a picture of its own. */
  product: ProductCardView | null
  first: boolean
  t: Translate
}) {
  const drawn = drawnVariant("hero", section.variant, HERO_VARIANTS)
  if (drawn === "category_list" && section.catalog) {
    return (
      <HeroCatalog hero={section} catalog={section.catalog} product={product} first={first} t={t} />
    )
  }
  if (drawn === "full_image" && section.full) {
    return <HeroFull hero={section} full={section.full} first={first} t={t} />
  }
  return <Hero hero={section} product={product} first={first} />
}
