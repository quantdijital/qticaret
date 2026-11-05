import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../../lib/catalog"
import { previewFacts } from "../../../lib/catalog/facts"
import type { FactsPreview } from "../../../lib/catalog/facts"
import { ValidationError } from "../../../lib/errors"
import type { FactsPreviewInput } from "./input"
import { readFactsProducts, readMatchTemplates } from "./read"

type Container = Pick<MedusaContainer, "resolve">

// Products read at a time: their documents can be long
const CHUNK = 100

/**
 * What the facts in the products' descriptions would become (adr/0013 Ek
 * 2026-11-05), in the order named: each product's rows and what each comes
 * to, the fields each template could take, the counts. Nothing is written.
 */
export async function previewDescriptionFacts(
  container: Container,
  input: FactsPreviewInput
): Promise<FactsPreview> {
  const templates = await readMatchTemplates(container)
  const given = input.template_id ? (templates.get(input.template_id) ?? null) : null
  if (input.template_id && !given) {
    throw new ValidationError("description_facts.template_unknown", { field: "template_id" })
  }
  const products = []
  for (const chunk of chunksOf(input.product_ids, CHUNK)) {
    const found = new Map(
      (await readFactsProducts(container, chunk, templates)).map((product) => [product.id, product])
    )
    for (const id of chunk) {
      const product = found.get(id)
      if (product) {
        products.push(product)
      }
    }
  }
  return previewFacts(products, given, [...templates.values()])
}
