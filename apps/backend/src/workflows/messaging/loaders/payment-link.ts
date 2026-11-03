import type { MedusaContainer } from "@medusajs/framework/types"
import type { PaymentLinkVars } from "../../../lib/messaging/templates"
import { formatLira, validityText } from "../../../lib/payment-links/share"
import { isOpen, linkNumber } from "../../../lib/payment-links/snapshot"
import type { PaymentLinkLine } from "../../../lib/payment-links/snapshot"
import { paymentLinkUrl } from "../../../lib/payment-links/token"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import type PaymentLinksModuleService from "../../../modules/payment-links/service"
import { brandOf } from "../brand"
import { GREETING, personName } from "./types"
import type { Loaded } from "./types"

/**
 * A payment link's message (adr/0051 §7): its lines, total and link, to
 * the contact it was made for. Null once it no longer opens, its token is
 * gone, or the shop has no storefront domain.
 */
export async function loadPaymentLinkMessage(
  container: Pick<MedusaContainer, "resolve">,
  linkId: string
): Promise<Loaded<PaymentLinkVars> | null> {
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  const [link] = await links.listPaymentLinks({ id: linkId }, { take: 1 })
  const sealed = links.openPrivate(link?.sealed)
  const token = links.openToken(link?.token_sealed)
  const { storefrontUrl } = await brandOf(container)
  if (!link || !isOpen(link) || !sealed || !token || !storefrontUrl) {
    return null
  }
  const lines = (Array.isArray(link.lines) ? link.lines : []) as unknown as PaymentLinkLine[]
  return {
    vars: {
      customerName: personName(sealed.contact.first_name) ?? GREETING,
      number: linkNumber(link.number),
      items: lines.map((line) => ({
        title: line.title,
        detail: line.variant_title,
        quantity: line.quantity,
        total: formatLira(line.unit_price * line.quantity),
      })),
      discount: link.discount_total > 0 ? `-${formatLira(link.discount_total)}` : null,
      total: formatLira(link.items_total - link.discount_total),
      validity: validityText(link.expires_at),
      url: paymentLinkUrl(storefrontUrl, token),
    },
    recipients: { email: sealed.contact.email, sms: sealed.contact.phone },
    receiverId: link.customer_id,
    resourceType: "payment_link",
  }
}
