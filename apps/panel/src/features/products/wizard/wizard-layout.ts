import { useProductLayout } from "@/features/products/layout/api"
import type { PartKey, ProductLayout } from "@/features/products/layout/parts"

/**
 * What the new product's wizard asks, as the shop laid out its product
 * page (docs/06 "Ürün sayfası"): a part the shop hid is not asked for
 * (its step or field is skipped and its value stays the valid default);
 * the parts that cannot hide (name and address, variants and price) are
 * always asked. A step left with nothing to ask is skipped.
 */
export interface WizardShown {
  /** The pictures step. */
  media: boolean
  /** The parcel step, for a physical product. */
  shipping: boolean
  description: boolean
  shortDescription: boolean
  /** Categories and KDV. */
  organize: boolean
  /** The product's kind (physical, digital, service). */
  catalog: boolean
  attributes: boolean
}

export const ALL_SHOWN: WizardShown = {
  media: true,
  shipping: true,
  description: true,
  shortDescription: true,
  organize: true,
  catalog: true,
  attributes: true,
}

export function wizardShown(layout: Pick<ProductLayout, "hidden">): WizardShown {
  const hidden = new Set<PartKey>(layout.hidden)
  return {
    media: !hidden.has("media"),
    shipping: !hidden.has("shipping"),
    description: !hidden.has("description"),
    shortDescription: !hidden.has("shortDescription"),
    organize: !hidden.has("organize"),
    catalog: !hidden.has("catalog"),
    attributes: !hidden.has("attributes"),
  }
}

/** The wizard's questions as the shop's saved layout has them. */
export function useWizardShown(): WizardShown {
  return wizardShown(useProductLayout())
}
