import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewDescriptionFacts } from "../../../../workflows/product-attributes/facts/preview"
import type { AdminPostDescriptionFactsPreviewType } from "./validators"

/**
 * What the facts in the products' descriptions would become (adr/0013 Ek
 * 2026-11-05): each product's rows, the field each names and its value,
 * the labels no field names with the field each could be. Nothing is
 * written: the panel sends what the shop ticked to the
 * `catalog.description_facts` job. A POST for the list of products it
 * takes; as a write, it is the catalog roles' (owner, admin).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostDescriptionFactsPreviewType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await previewDescriptionFacts(req.scope, req.validatedBody))
}
