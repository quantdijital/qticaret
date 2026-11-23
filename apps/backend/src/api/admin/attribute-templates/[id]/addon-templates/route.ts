import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { carryAddonTemplatesWorkflow } from "../../../../../workflows/addon-templates"
import type { AdminPostCarriedAddonTemplatesType } from "../../../addon-templates/validators"
import { readTemplate } from "../../read"

/**
 * The add-on templates the attribute template carries, in order (adr/0052
 * Ek 2026-11-23): every product following it gets their add-ons.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCarriedAddonTemplatesType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await carryAddonTemplatesWorkflow(req.scope).run({
    input: {
      attribute_template_id: id,
      addon_template_ids: req.validatedBody.addon_template_ids,
    },
  })
  res.json({ attribute_template: await readTemplate(req.scope, id) })
}
