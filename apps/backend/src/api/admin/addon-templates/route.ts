import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createAddonTemplateWorkflow } from "../../../workflows/addon-templates"
import { readAddonTemplate, readAddonTemplates } from "./read"
import type { AdminGetAddonTemplatesType, AdminPostAddonTemplateType } from "./validators"

/** Add-on templates by name (adr/0052 Ek 2026-11-23), with who uses them. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset } = req.validatedQuery as AdminGetAddonTemplatesType
  const { templates, count } = await readAddonTemplates(
    req.scope,
    {},
    { skip: offset, take: limit }
  )
  res.json({ addon_templates: templates, count, offset, limit })
}

/** A new template; its add-ons get their ids here. Needs the shop's `catalog.addons`. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAddonTemplateType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createAddonTemplateWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ addon_template: await readAddonTemplate(req.scope, result.id) })
}
