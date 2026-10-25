import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { upsertProductAttributesWorkflow } from "../../../../../workflows/product-attributes/upsert-product-attributes"
import { readProductAttributes } from "./read"
import type { AdminPostProductAttributesType } from "./validators"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

/** The product's attribute template and values (adr/0013). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readProductAttributes(req.scope, idOf(req)))
}

/**
 * Sets the product's template and values. Values left out keep theirs, null
 * clears one; a different template drops the old template's values.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostProductAttributesType>,
  res: MedusaResponse
): Promise<void> {
  await upsertProductAttributesWorkflow(req.scope).run({
    input: {
      product_id: idOf(req),
      template_id: req.validatedBody.template_id,
      values: req.validatedBody.values,
      confirm_template_change: req.validatedBody.confirm_template_change,
    },
  })
  res.json(await readProductAttributes(req.scope, idOf(req)))
}
