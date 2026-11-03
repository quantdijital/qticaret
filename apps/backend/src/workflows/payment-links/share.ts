import type { MedusaContainer } from "@medusajs/framework/types"
import { shareText, whatsappUrl } from "../../lib/payment-links/share"
import { isOpen } from "../../lib/payment-links/snapshot"
import { paymentLinkUrl } from "../../lib/payment-links/token"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { brandOf } from "../messaging/brand"
import { sentChannels } from "./send"
import type { LinkRow } from "./views"

type Container = Pick<MedusaContainer, "resolve">

export interface LinkShare {
  /** The storefront's `/ode/<token>`; null once the link no longer opens. */
  url: string | null
  sms_text: string | null
  whatsapp_url: string | null
  email_sent: boolean
  sms_sent: boolean
}

/**
 * What staff copy or open to share the link (adr/0051 §7): the link, the
 * text an SMS or WhatsApp carries, and the WhatsApp address with the
 * customer's mobile when there is one. The text names no one.
 */
export async function linkShare(
  container: Container,
  link: Pick<
    LinkRow,
    "id" | "status" | "expires_at" | "items_total" | "discount_total" | "sealed"
  > & { token_sealed: string | null }
): Promise<LinkShare> {
  const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
  const sent = await sentChannels(container, link.id)
  const token = links.openToken(link.token_sealed)
  const brand = await brandOf(container)
  if (!isOpen(link) || !token || !brand.storefrontUrl) {
    return {
      url: null,
      sms_text: null,
      whatsapp_url: null,
      email_sent: sent.email,
      sms_sent: sent.sms,
    }
  }
  const url = paymentLinkUrl(brand.storefrontUrl, token)
  const text = shareText({
    shopName: brand.shopName,
    total: link.items_total - link.discount_total,
    expiresAt: link.expires_at,
    url,
  })
  const phone = links.openPrivate(link.sealed)?.contact.phone ?? null
  return {
    url,
    sms_text: text,
    whatsapp_url: whatsappUrl(text, phone),
    email_sent: sent.email,
    sms_sent: sent.sms,
  }
}
