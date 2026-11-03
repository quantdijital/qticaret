import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { orderAccessKey } from "../../lib/orders/access-token"
import { PAYMENT_LINK_TOKEN_SHAPE, paymentLinkTokenValid } from "../../lib/payment-links/token"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The link a customer's token opens (adr/0051 §3): signed by us and before
 * its end, then found, then open or waiting on its prices, before its own
 * end. Anything else is the same 404 (`payment_link.unavailable`): an
 * unknown, ended, paid or canceled link reads alike. A token we did not
 * sign is turned away before any table is read.
 */
export async function storeLink(container: Container, token: string, now = new Date()) {
  const signed =
    PAYMENT_LINK_TOKEN_SHAPE.test(token) && paymentLinkTokenValid(orderAccessKey(), token, now)
  const link = signed
    ? await container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE).byToken(token)
    : null
  if (
    !link ||
    (link.status !== "open" && link.status !== "draft") ||
    new Date(link.expires_at).getTime() <= now.getTime()
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.unavailable")
  }
  return link
}
