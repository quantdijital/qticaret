import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { variantGtin } from "../../../../../lib/catalog"
import { storedAddonsOf } from "../../../../../lib/catalog/addons"
import { summaryDocOf } from "../../../../../lib/catalog/summary"
import type { ContentDoc } from "../../../../../lib/content"
import { effectiveAddonsAmong } from "../../../../../workflows/addons/effective"

interface ProductRow {
  id: string
  categories?: ({ id: string; name: string } | null)[] | null
  variants?:
    | ({
        id: string
        title: string | null
        sku: string | null
        ean: string | null
        upc: string | null
        barcode: string | null
        variant_extension?: { mpn: string | null; cost: number | null } | null
      } | null)[]
    | null
  product_extension?: {
    condition: string
    kind: string
    primary_category_id: string | null
    successor_product_id: string | null
    withdrawal_excluded?: boolean | null
    restriction?: string | null
    is_gift_card?: boolean | null
    addons?: unknown
    description_doc?: unknown
    summary_doc?: unknown
    booking_mode?: string | null
    badge?: string | null
    max_quantity?: number | null
  } | null
}

/** Kuruş as the panel's money fields take it. */
const costInLira = (kurus: number | null) => (kurus === null ? null : kurus / 100)

const present = <T>(items: (T | null)[] | null | undefined): T[] =>
  (items ?? []).filter((item): item is T => item !== null)

async function productTitle(scope: MedusaContainer, id: string | null) {
  if (!id) {
    return null
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle"],
    filters: { id },
  })
  return (data[0] as { id: string; title: string; handle: string } | undefined) ?? null
}

/**
 * A product's catalog fields (F3.1) with what the admin shows beside them:
 * its categories to pick the primary one from, the successor's title, and
 * each variant's MPN, unit cost (lira, VAT excluded; F11.4) and the GTIN
 * structured data would use. A primary
 * category the product no longer has reads as unset.
 */
export async function readProductCatalog(scope: MedusaContainer, productId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "categories.id",
      "categories.name",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.ean",
      "variants.upc",
      "variants.barcode",
      "variants.variant_extension.mpn",
      "variants.variant_extension.cost",
      "product_extension.*",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const extension = product.product_extension ?? null
  const categories = present(product.categories).map(({ id, name }) => ({ id, name }))
  const primary = extension?.primary_category_id ?? null
  const effective = (await effectiveAddonsAmong(scope, [productId])).get(productId)
  return {
    condition: extension?.condition ?? "new",
    kind: extension?.kind ?? "physical",
    withdrawal_excluded: extension?.withdrawal_excluded ?? false,
    restriction: extension?.restriction ?? null,
    is_gift_card: extension?.is_gift_card ?? false,
    // adr/0052: prices in lira, as saved
    addons: storedAddonsOf(extension?.addons ?? null),
    // adr/0052 Ek 2026-11-23: the templates it reaches (live), and what is past five
    addon_templates: effective?.templates ?? [],
    addons_hidden: effective?.hidden ?? 0,
    // adr/0055: the document as saved; null, the product has plain text only
    description_doc: (extension?.description_doc ?? null) as ContentDoc | null,
    // adr/0055 Ek 2026-11-06: the short description as written; null, none
    summary_doc: summaryDocOf(extension?.summary_doc),
    // adr/0076 §2: a dated product's booking mode; `none` for every other
    booking_mode: extension?.booking_mode ?? "none",
    // The product's own card badge; null, none
    badge: extension?.badge ?? null,
    // S5: the most of it one order may hold; null, no limit
    max_quantity: extension?.max_quantity ?? null,
    primary_category_id: categories.some((category) => category.id === primary) ? primary : null,
    successor: await productTitle(scope, extension?.successor_product_id ?? null),
    categories,
    variants: present(product.variants).map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      mpn: variant.variant_extension?.mpn ?? null,
      cost: costInLira(variant.variant_extension?.cost ?? null),
      gtin: variantGtin(variant),
    })),
  }
}

export type ProductCatalog = Awaited<ReturnType<typeof readProductCatalog>>
