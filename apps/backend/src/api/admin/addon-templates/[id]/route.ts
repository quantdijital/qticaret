import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteAddonTemplateWorkflow,
  updateAddonTemplateWorkflow,
} from "../../../../workflows/addon-templates"
import { readAddonTemplate } from "../read"
import type { AdminUpdateAddonTemplateType } from "../validators"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ addon_template: await readAddonTemplate(req.scope, idOf(req)) })
}

/**
 * Changes a template: every product using it reads the change at once
 * (live link). `addons` is the whole list; ids sent are kept.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAddonTemplateType>,
  res: MedusaResponse
): Promise<void> {
  await updateAddonTemplateWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: idOf(req) },
  })
  res.json({ addon_template: await readAddonTemplate(req.scope, idOf(req)) })
}

/** Deletes a template; its products lose its add-ons, orders keep what they recorded. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await deleteAddonTemplateWorkflow(req.scope).run({ input: { id: idOf(req) } })
  res.json({ id: idOf(req), object: "addon_template", deleted: true })
}
