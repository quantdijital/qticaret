import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { convertAttributeDefinitionWorkflow } from "../../../../../../../workflows/product-attributes/templates"
import { readTemplate } from "../../../../read"
import type { AdminPostConvertDefinitionType } from "../../../../validators"

/**
 * Turns a text attribute that products have values for into a single
 * choice (adr/0013 Ek 2026-11-05): the options, and every stored text's
 * option or `null` to clear it. Answers the template as it now is.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostConvertDefinitionType>,
  res: MedusaResponse
): Promise<void> {
  const templateId = req.params["id"] ?? ""
  await convertAttributeDefinitionWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      template_id: templateId,
      definition_id: req.params["definition_id"] ?? "",
    },
  })
  res.json({ attribute_template: await readTemplate(req.scope, templateId) })
}
