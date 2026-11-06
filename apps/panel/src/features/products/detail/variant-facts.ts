import type { StatusTone } from "@/components/patterns/status-badge"
import type { PriceDisplayView } from "@/features/products/api/price-history"
import type { ProductDetail } from "@/features/products/api/products"
import { ruleState } from "@/features/products/price-history"
import { gtinProblem } from "@/lib/gtin"
import { savedCodes } from "./variant-codes"
import type { CatalogVariant } from "./variant-codes"
import { levelAt, priceOf, sortedImages, tiedTo } from "./variant-values"
import type { Variant } from "./variant-values"

export interface VariantHint {
  key: string
  tone: StatusTone
}

/** What a variant's row shows, read from what is stored. */
export interface VariantFacts {
  /** Its option values ("Renk: Mor · Boy: 18 cm"), else its title. */
  name: string
  sku: string
  price: number | null
  /**
   * What the storefront sells it for today and strikes through beside it,
   * when a campaign or a price list lowers it and the price-before rule
   * lets the discount show; null otherwise.
   */
  sale: { price: number; struck: number } | null
  /** Its stock at the default location; null when not tracked. */
  stock: number | null
  backorder: boolean
  /** Its first own picture, else the product's. */
  thumb: string | null
  /** At most two short notes, the most pressing first ("Fiyat yok", "Barkod yok"). */
  hints: VariantHint[]
}

/** "Renk: Mor · Boy: 18 cm": the variant's values with their options' names. */
export function variantName(product: ProductDetail, variant: Variant): string {
  const titles = new Map((product.options ?? []).map((option) => [option.id, option.title]))
  const values = (variant.options ?? []).flatMap((value) => {
    const option = value.option_id ? titles.get(value.option_id) : undefined
    return value.value ? [option ? `${option}: ${value.value}` : value.value] : []
  })
  return values.length > 0 ? values.join(" · ") : (variant.title ?? "")
}

/** The variant's own first picture, else the product's thumbnail or first picture. */
export function variantThumb(product: ProductDetail, variantId: string): string | null {
  const images = sortedImages(product)
  const own = images.find((image) => tiedTo(image).includes(variantId))
  return own?.url ?? product.thumbnail ?? images[0]?.url ?? null
}

/** The other variants each stored picture is tied to (their titles), by the picture's id. */
export function imageTies(product: ProductDetail, variantId: string): Map<string, string[]> {
  const names = new Map((product.variants ?? []).map((each) => [each.id, each.title ?? ""]))
  return new Map(
    sortedImages(product).map((image) => [
      image.id,
      tiedTo(image)
        .filter((id) => id !== variantId)
        .map((id) => names.get(id) ?? ""),
    ])
  )
}

/** Today's price and the one struck through beside it, when the storefront shows a discount. */
function saleOf(display: PriceDisplayView | null | undefined): VariantFacts["sale"] {
  if (!display || ruleState(display) !== "struck") {
    return null
  }
  const price = Number(display.current)
  const struck = Number(display.before ?? display.regular)
  return struck > price ? { price, struck } : null
}

export function variantFacts(
  product: ProductDetail,
  variant: Variant,
  locationId: string | null,
  catalog: CatalogVariant | undefined,
  display: PriceDisplayView | null | undefined
): VariantFacts {
  const price = priceOf(variant)
  const tracked = Boolean(variant.manage_inventory)
  const stock = tracked ? levelAt(variant, locationId).stocked : null
  const backorder = Boolean(variant.allow_backorder)
  const codes = savedCodes(variant, catalog)
  const barcode = codes.gtin.trim() !== "" && gtinProblem(codes.gtin) === null
  const hints: VariantHint[] = [
    ...(price === null ? [{ key: "noPrice", tone: "warning" as const }] : []),
    ...(stock === 0 && !backorder ? [{ key: "soldOut", tone: "warning" as const }] : []),
    ...(backorder ? [{ key: "preorder", tone: "info" as const }] : []),
    ...(!barcode && codes.mpn.trim() === ""
      ? [{ key: "noBarcode", tone: "neutral" as const }]
      : []),
  ]
  return {
    name: variantName(product, variant),
    sku: codes.sku,
    price,
    sale: saleOf(display),
    stock,
    backorder,
    thumb: variantThumb(product, variant.id),
    hints: hints.slice(0, 2),
  }
}
