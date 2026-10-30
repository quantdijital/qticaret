import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
import { logger } from "../../../../../lib/logging"
import { heldToCookieConsent, secureCookies, visitorIdOf } from "../../../../../lib/legal/visitor"
import { CONVERSIONS_MODULE } from "../../../../../modules/conversions"
import type ConversionsModuleService from "../../../../../modules/conversions/service"
import { LEGAL_MODULE } from "../../../../../modules/legal"
import type LegalModuleService from "../../../../../modules/legal/service"
import type { StorePostCartTrackingType } from "./validators"

/**
 * POST /store/carts/:id/tracking (F10.9, adr/0038 §4): what the shopper
 * allowed in the cookie banner, kept against the cart until it becomes an
 * order. The browser's IP address and user agent are taken from the
 * request, and only with marketing consent. Sent again, the last answer
 * counts. A visitor with a kept cookie banner answer (F13.8) is held to
 * it; without one, the flags must be sent.
 */
export async function POST(
  req: MedusaRequest<StorePostCartTrackingType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at"],
    filters: { id: cartId },
  })
  const cart = data[0] as { completed_at: unknown } | undefined
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const body = req.validatedBody
  const visitorId = visitorIdOf(req.headers.cookie, secureCookies())
  const answer = visitorId
    ? await req.scope.resolve<LegalModuleService>(LEGAL_MODULE).latestCookieConsent(visitorId)
    : null
  if (!answer && (body.analytics === undefined || body.marketing === undefined)) {
    throw new ValidationError("legal.cookie_consent_missing", { field: "analytics" })
  }
  if (!answer) {
    // A storefront sending no cookie skips the banner's own record: counted, to be found
    logger.info({ event: "conversions.tracking_without_cookie_answer" })
  }
  const flags = answer
    ? heldToCookieConsent(body, answer)
    : { analytics: body.analytics === true, marketing: body.marketing === true }
  const agent = req.get("user-agent")
  await req.scope.resolve<ConversionsModuleService>(CONVERSIONS_MODULE).recordCart(cartId, {
    ...body,
    ...flags,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    user_agent: agent ? agent.slice(0, 500) : null,
    cookie_consent_id: answer?.id ?? null,
  })
  res.json({ tracking: flags })
}
