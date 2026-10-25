import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { createAttributeTemplateWorkflow } from "../../../workflows/product-attributes/templates"
import { readTemplate } from "./read"
import type { AdminGetAttributeTemplatesType, AdminPostAttributeTemplateType } from "./validators"

/** Attribute templates with their definitions, by name (adr/0013). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset } = req.validatedQuery as AdminGetAttributeTemplatesType
  const service = req.scope.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
  const [templates, count] = await service.listAndCountAttributeTemplates(
    {},
    { relations: ["definitions"], order: { name: "ASC" }, skip: offset, take: limit }
  )
  res.json({ attribute_templates: templates, count, offset, limit })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAttributeTemplateType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createAttributeTemplateWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.json({ attribute_template: await readTemplate(req.scope, result.id) })
}
