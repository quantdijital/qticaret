import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { ATTRIBUTE_RELATION, fieldTokens } from "../validation/attribute-fields"

interface ProductRow {
  attribute_values?: ({ id?: string } | null)[] | null
}

/** The products an answer carries: one product's page, or a list. */
function productsOf(body: unknown): ProductRow[] {
  const answer = body as { product?: unknown; products?: unknown } | null
  const listed: unknown[] = Array.isArray(answer?.products) ? (answer.products as unknown[]) : []
  const rows = [answer?.product, ...listed]
  return rows.filter((row): row is ProductRow => typeof row === "object" && row !== null)
}

/** The value ids shown to shoppers of these: those of a public attribute. */
async function shownOf(container: MedusaContainer, ids: string[]): Promise<Set<string>> {
  const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
  const values = await service.listAttributeValues(
    { id: ids },
    { select: ["id", "definition_id"], take: ids.length }
  )
  const definitionIds = [...new Set(values.map((value) => value.definition_id))]
  const hidden = definitionIds.length
    ? await service.listAttributeDefinitions(
        { id: definitionIds, is_public: false },
        { select: ["id"], take: definitionIds.length }
      )
    : []
  const hiddenIds = new Set(hidden.map((definition) => definition.id))
  return new Set(
    values.filter((value) => !hiddenIds.has(value.definition_id)).map((value) => value.id)
  )
}

/** The answer with only shown values: one without an id, or not found, is left out. */
async function withoutHidden(container: MedusaContainer, body: unknown): Promise<unknown> {
  const products = productsOf(body).filter((product) => Array.isArray(product.attribute_values))
  const ids = products.flatMap((product) =>
    (product.attribute_values ?? []).flatMap((value) => (value?.id ? [value.id] : []))
  )
  const shown = ids.length ? await shownOf(container, ids) : new Set<string>()
  for (const product of products) {
    product.attribute_values = (product.attribute_values ?? []).filter((value) =>
      shown.has(value?.id ?? "")
    )
  }
  return body
}

/**
 * Keeps the attributes the shop holds to itself (T5, adr/0013 addendum)
 * out of the Store API: Medusa reads a product's values through the link
 * whatever their definition says, so the answer is cleaned before it
 * goes. When that read fails, every value is left out rather than one
 * hidden shown.
 */
export function hidePrivateAttributes(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "GET" || !fieldTokens(req).some((token) => ATTRIBUTE_RELATION.test(token))) {
    next()
    return
  }
  const send = res.json.bind(res)
  res.json = (body: unknown) => {
    withoutHidden(req.scope, body)
      .then(send, (error: unknown) => {
        logger.warn({ event: "store.attributes_unfiltered", err: errorSummary(error) })
        for (const product of productsOf(body)) {
          product.attribute_values = []
        }
        send(body)
      })
      // The answer itself failing (the client gone): logged, never a crash
      .catch((error: unknown) => {
        logger.warn({ event: "store.attributes_unsent", err: errorSummary(error) })
      })
    return res
  }
  next()
}
