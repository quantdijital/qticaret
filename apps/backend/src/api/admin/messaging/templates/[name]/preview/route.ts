import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ownTextsOf } from "../../../../../../lib/messaging/editable/check"
import { MESSAGE_TEMPLATES } from "../../../../../../lib/messaging/templates"
import type { MessageTemplate } from "../../../../../../lib/messaging/templates"
import { messagePreview } from "../../../../../../workflows/messaging/preview"
import { checkDraftTexts, sendTextsOf } from "../../../../../../workflows/messaging/template-texts"
import type { AdminPostTemplateTextsType } from "../../../customer-messages/validators"

function templateParam(req: AuthenticatedMedusaRequest): MessageTemplate<unknown> {
  const name = req.params["name"] ?? ""
  const template = Object.hasOwn(MESSAGE_TEMPLATES, name)
    ? (MESSAGE_TEMPLATES[name as keyof typeof MESSAGE_TEMPLATES] as MessageTemplate<unknown>)
    : null
  if (!template) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "messaging.template_unknown")
  }
  return template
}

/**
 * GET /admin/messaging/templates/:name/preview (F9.3): the message with
 * its made-up sample, the shop's own details and links in place, in its
 * logo, colour and name, as the e-mail and the SMS would read, in the
 * shop's own words where it wrote some (adr/0036 Ek 2026-11-10). Nothing
 * is sent.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const template = templateParam(req)
  const { own } = await sendTextsOf(req.scope, template.name)
  const { email, sms } = await messagePreview(req.scope, template, own)
  res.setHeader("Cache-Control", "no-store")
  res.json({ name: template.name, kind: template.kind, email, sms })
}

/**
 * POST /admin/messaging/templates/:name/preview: the same with words not
 * yet saved, checked as a save checks them (an unknown `{belirteç}` is
 * refused, named). Nothing is saved, nothing is sent.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostTemplateTextsType>,
  res: MedusaResponse
): Promise<void> {
  const template = templateParam(req)
  const checked = await checkDraftTexts(req.scope, template.name, req.validatedBody)
  const { email, sms } = await messagePreview(req.scope, template, ownTextsOf(checked))
  res.setHeader("Cache-Control", "no-store")
  res.json({ name: template.name, kind: template.kind, email, sms })
}
