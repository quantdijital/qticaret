import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteAttributeTemplateWorkflow,
  updateAttributeTemplateWorkflow,
} from "../../../../workflows/product-attributes/templates"
import { readTemplate } from "../read"
import type { AdminUpdateAttributeTemplateType } from "../validators"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ attribute_template: await readTemplate(req.scope, idOf(req)) })
}

/**
 * Changes a template. `definitions` is the full list; removing one that
 * products have values for needs `confirm_delete_values` (adr/0013).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAttributeTemplateType>,
  res: MedusaResponse
): Promise<void> {
  await updateAttributeTemplateWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: idOf(req) },
  })
  res.json({ attribute_template: await readTemplate(req.scope, idOf(req)) })
}

/** Deletes a template no product follows. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await deleteAttributeTemplateWorkflow(req.scope).run({ input: { id: idOf(req) } })
  res.json({ id: idOf(req), object: "attribute_template", deleted: true })
}
