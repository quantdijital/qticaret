import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { summaryDocOf } from "../../../../../lib/catalog/summary"
import { contentDoc, renderDoc } from "../../../../../lib/content"

interface ProductRow {
  status?: string | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { description_doc?: unknown; summary_doc?: unknown } | null
}

/**
 * GET /store/products/:id/description (adr/0055): a published product's
 * description document of this storefront as the server renders a page's
 * (adr/0019), for the product page; null when the product has plain text
 * only (the page shows `description`). Its short description (adr/0055 Ek
 * 2026-11-06) as `summary_html`, the same way; null without one. A stored
 * document is checked again before it is rendered: one that no longer
 * reads as a document is none. Another product reads as unknown.
 */
export async function storeProductDescription(
  container: Pick<MedusaContainer, "resolve">,
  productId: string,
  salesChannelIds: readonly string[]
): Promise<{ html: string | null; summary_html: string | null }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "status",
      "sales_channels.id",
      "product_extension.description_doc",
      "product_extension.summary_doc",
    ],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  const listed = (product?.sales_channels ?? []).some((channel) =>
    salesChannelIds.includes(channel?.id ?? "")
  )
  if (product?.status !== "published" || !listed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const stored = product.product_extension?.description_doc
  const doc = stored === null || stored === undefined ? null : contentDoc.safeParse(stored)
  const html = doc?.success ? renderDoc(doc.data) : ""
  const summary = summaryDocOf(product.product_extension?.summary_doc)
  const summaryHtml = summary ? renderDoc(summary) : ""
  return { html: html === "" ? null : html, summary_html: summaryHtml === "" ? null : summaryHtml }
}
