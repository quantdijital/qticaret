import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MESSAGE_TEMPLATES } from "../../../../../../lib/messaging/templates"
import type { MessageTemplate } from "../../../../../../lib/messaging/templates"
import { messagePreview } from "../../../../../../workflows/messaging/preview"

/**
 * GET /admin/messaging/templates/:name/preview (F9.3): the message with
 * its made-up sample, the shop's own details and links in place, in its
 * logo, colour and name, as the e-mail and the SMS would read. Nothing is sent.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const name = req.params["name"] ?? ""
  const template = Object.hasOwn(MESSAGE_TEMPLATES, name)
    ? (MESSAGE_TEMPLATES[name as keyof typeof MESSAGE_TEMPLATES] as MessageTemplate<unknown>)
    : null
  if (!template) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.template_unknown")
  }
  const { email, sms } = await messagePreview(req.scope, template)
  res.setHeader("Cache-Control", "no-store")
  res.json({ name: template.name, kind: template.kind, email, sms })
}
