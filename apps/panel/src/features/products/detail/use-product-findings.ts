import { useQuery } from "@tanstack/react-query"
import { productAttributesQuery } from "@/features/attributes/api"
import { isEmpty } from "@/features/attributes/empty"
import { useSectionFindings } from "@/features/content/section-findings"
import type { ProductDetail } from "@/features/products/api/products"
import { MAIN_PARTS, SIDE_PARTS } from "@/features/products/layout/parts"
import type { PartKey } from "@/features/products/layout/parts"
import { assessmentQuery } from "@/features/seo/api/advisor"
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

/** What is known of a part's state: none for a part nothing measures (the summary, the FAQ). */
export type PartMark = "complete" | "missing" | "urgent" | null

/**
 * What the advisor and the attributes say of each part (docs/06 "Ürün
 * sayfası"): its findings counted over the element ids it holds, and an
 * empty required attribute. Before the advisor answers, nothing is known.
 */
function usePartState(product: ProductDetail) {
  const findings = useProductFindings(product)
  const known = useQuery(assessmentQuery("product", product.id, product.updated_at)).isSuccess
  const attributes = useQuery(productAttributesQuery(product.id)).data
  const requiredEmpty = (attributes?.template?.definitions ?? []).some(
    (definition) =>
      definition.scope === "product" &&
      definition.is_required &&
      isEmpty(attributes?.values[definition.key])
  )
  return (key: PartKey) => {
    const targets = [...MAIN_PARTS, ...SIDE_PARTS].find((each) => each.key === key)?.targets ?? []
    const found = targets.map((target) => findings(target))
    const empty = key === "attributes" && requiredEmpty
    return {
      measured: targets.length > 0 || key === "attributes",
      known,
      count: found.reduce((sum, each) => sum + each.count, 0) + (empty ? 1 : 0),
      urgent: empty || found.some((each) => each.attention),
    }
  }
}

/**
 * Whether a part needs the person whatever the layout says: an urgent
 * finding of the advisor for it, or a required attribute left empty. A
 * part the shop hid is shown anyway then.
 */
export function usePartAttention(product: ProductDetail): (key: PartKey) => boolean {
  const state = usePartState(product)
  return (key) => state(key).urgent
}

/** Each part's mark in the page's section bar: complete, something missing, or urgent. */
export function usePartMarks(product: ProductDetail): (key: PartKey) => PartMark {
  const state = usePartState(product)
  return (key) => {
    const part = state(key)
    if (!part.measured || (!part.known && !part.urgent)) {
      return null
    }
    return part.urgent ? "urgent" : part.count > 0 ? "missing" : "complete"
  }
}
