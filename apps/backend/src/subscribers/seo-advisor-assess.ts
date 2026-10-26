import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { PageKind } from "../lib/seo/advisor"
import { errorSummary, logger } from "../lib/logging"
import { assessPage } from "../workflows/seo/advisor/assess"

const KINDS: Readonly<Record<string, PageKind>> = {
  "product.created": "product",
  "product.updated": "product",
  "product.deleted": "product",
  "product-category.created": "category",
  "product-category.updated": "category",
  "product-category.deleted": "category",
  "product-collection.created": "collection",
  "product-collection.updated": "collection",
  "product-collection.deleted": "collection",
  "brand.saved": "brand",
  "brand.deleted": "brand",
  // An image's alt text: its product's (`id` is the product's)
  "media.saved": "product",
}

const SEO_KINDS: Readonly<Record<string, PageKind>> = {
  product: "product",
  category: "category",
  collection: "collection",
  brand: "brand",
}

async function productOfVariant(
  container: SubscriberArgs["container"],
  variantId: string
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["product_id"],
    filters: { id: variantId },
    withDeleted: true,
  })
  return (data[0] as { product_id?: string } | undefined)?.product_id ?? null
}

/**
 * A saved page is assessed again (docs/14 §1) after the save answers, so
 * lists and the shop's score stay current; a deleted one loses its
 * assessment. A variant's change is its product's.
 */
export default async function seoAdvisorAssess({
  event,
  container,
}: SubscriberArgs<{ id?: string; entity_type?: string; entity_id?: string }>) {
  let kind: PageKind | undefined
  let id: string | null | undefined
  if (event.name === "seo-meta.saved") {
    kind = Object.hasOwn(SEO_KINDS, event.data.entity_type ?? "")
      ? SEO_KINDS[event.data.entity_type ?? ""]
      : undefined
    id = event.data.entity_id
  } else if (event.name.startsWith("product-variant.")) {
    kind = "product"
    id = event.data.id ? await productOfVariant(container, event.data.id) : null
  } else {
    kind = Object.hasOwn(KINDS, event.name) ? KINDS[event.name] : undefined
    id = event.data.id
  }
  if (!kind || !id) {
    return
  }
  try {
    await assessPage(container, kind, id)
  } catch (error) {
    // An assessment never fails a save; the nightly run catches up
    logger.warn({ event: "seo.assessment_failed", kind, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: [
    ...Object.keys(KINDS),
    "seo-meta.saved",
    "product-variant.created",
    "product-variant.updated",
  ],
}
