import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { editableTemplate } from "../../../../../lib/messaging/editable/registry"
import {
  customerMessageView,
  saveTemplateTextsWorkflow,
} from "../../../../../workflows/messaging/template-texts"
import type { AdminPostTemplateTextsType } from "../validators"

/**
 * POST /admin/messaging/customer-messages/:name (adr/0036 Ek 2026-11-10):
 * the shop's words for a customer message and, where allowed, whether it
 * goes. Owner and admin (the staff roles' default for a write); a field
 * left out keeps its value, `null` or the platform's text brings it back.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostTemplateTextsType>,
  res: MedusaResponse
): Promise<void> {
  const name = req.params["name"] ?? ""
  if (!editableTemplate(name)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.template_unknown")
  }
  await saveTemplateTextsWorkflow(req.scope).run({
    input: {
      template: name,
      values: req.validatedBody,
      actor_id: req.auth_context.actor_id || null,
    },
  })
  res.json({ customer_message: await customerMessageView(req.scope, name) })
}
