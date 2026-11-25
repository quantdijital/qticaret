import { useQuery } from "@tanstack/react-query"
import { productAttributesQuery } from "@/features/attributes/api"
import { isEmpty } from "@/features/attributes/empty"
import { useSectionFindings } from "@/features/content/section-findings"
import type { ProductDetail } from "@/features/products/api/products"
import { MAIN_PARTS, SIDE_PARTS } from "@/features/products/layout/parts"
import type { PartKey } from "@/features/products/layout/parts"
import { PRODUCT_TARGETS } from "./sections"

/** The advisor's findings for one part of the product's page, by its element id. */
export function useProductFindings(product: ProductDetail) {
  return useSectionFindings({
    kind: "product",
    id: product.id,
    version: product.updated_at,
    targets: PRODUCT_TARGETS,
  })
}

/**
 * Whether a part needs the person whatever the layout says (docs/06
 * "Ürün sayfası"): an urgent finding of the advisor for it, or a required
 * attribute left empty. A part the shop hid is shown anyway then.
 */
export function usePartAttention(product: ProductDetail): (key: PartKey) => boolean {
  const findings = useProductFindings(product)
  const attributes = useQuery(productAttributesQuery(product.id)).data
  const requiredEmpty = (attributes?.template?.definitions ?? []).some(
    (definition) =>
      definition.scope === "product" &&
      definition.is_required &&
      isEmpty(attributes?.values[definition.key])
  )
  return (key) => {
    if (key === "attributes" && requiredEmpty) {
      return true
    }
    const part = [...MAIN_PARTS, ...SIDE_PARTS].find((each) => each.key === key)
    return (part?.targets ?? []).some((target) => findings(target).attention)
  }
}
