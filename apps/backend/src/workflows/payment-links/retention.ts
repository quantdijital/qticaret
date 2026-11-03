import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { COMPLETION_GRACE_MS, RETENTION_DAYS, linkNumber } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { closeLinkPromotion } from "./promotion"

type Container = Pick<MedusaContainer, "resolve">

const DAY_MS = 24 * 60 * 60 * 1000
// Links handled a run: a shop makes a few a day; a backlog clears over runs
const PAGE = 500

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** What a link keeps once its personal data goes: the numbers and who made it. */
const PURGED = {
  sealed: null,
  email_hash: null,
  token_sealed: null,
  token_hash: null,
  note: null,
}

/**
 * Links past their end (and the hour a payment under way may still take)
 * become `expired`, their code closed; links closed thirty days ago lose
 * their contact, token and note (docs/kvkk-envanter.md). Counts each.
 */
export async function sweepPaymentLinks(
  container: Container,
  now = new Date()
): Promise<{ expired: number; purged: number }> {
  const links = service(container)
  const due = await links.listPaymentLinks(
    {
      status: ["open", "draft"],
      expires_at: { $lt: new Date(now.getTime() - COMPLETION_GRACE_MS) },
    },
    { select: ["id", "promotion_id"], take: PAGE, order: { expires_at: "ASC" } }
  )
  let expired = 0
  for (const link of due) {
    try {
      await links.updatePaymentLinks({ id: link.id, status: "expired", closed_at: now })
      await closeLinkPromotion(container, link.promotion_id)
      expired += 1
    } catch (error) {
      logger.warn({
        event: "payment_links.expire_failed",
        linkId: link.id,
        err: errorSummary(error),
      })
    }
  }
  const old = await links.listPaymentLinks(
    { closed_at: { $lt: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) }, purged_at: null },
    { select: ["id"], take: PAGE }
  )
  if (old.length > 0) {
    await links.updatePaymentLinks(old.map((link) => ({ id: link.id, ...PURGED, purged_at: now })))
  }
  return { expired, purged: old.length }
}

/** The person's links: by their customer record, or by their e-mails' keyed hashes. */
async function linksOfPerson(container: Container, customerId: string, addresses: string[]) {
  const links = service(container)
  const hashes = addresses.flatMap((address) => links.emailHashOf(address) ?? [])
  return links.listPaymentLinks(
    hashes.length
      ? { $or: [{ customer_id: customerId }, { email_hash: hashes }] }
      : { customer_id: customerId },
    { take: null }
  )
}

/** For a KVKK copy (adr/0041 §6): the links made for them and where each stands. */
export async function paymentLinksFor(
  container: Container,
  customerId: string,
  addresses: string[]
) {
  const rows = await linksOfPerson(container, customerId, addresses)
  return rows.map((link) => ({
    bağlantı: linkNumber(link.number),
    durum: link.status,
    oluşturulma: link.created_at,
    bitiş: link.expires_at,
    tutar_kuruş: link.items_total - link.discount_total,
    sipariş: link.order_id,
    iletişim: service(container).openPrivate(link.sealed),
  }))
}

/**
 * For a KVKK erasure: an open link of theirs is canceled (its code
 * closed), and every one loses its contact, token and note. The numbers
 * stay, for the orders that came of them.
 */
export async function erasePaymentLinks(
  container: Container,
  customerId: string,
  addresses: string[]
): Promise<number> {
  const rows = await linksOfPerson(container, customerId, addresses)
  const links = service(container)
  const now = new Date()
  for (const link of rows) {
    const live = link.status === "open" || link.status === "draft"
    await links.updatePaymentLinks({
      id: link.id,
      ...PURGED,
      purged_at: now,
      ...(live ? { status: "canceled" as const, closed_at: now } : {}),
    })
    if (live) {
      await closeLinkPromotion(container, link.promotion_id)
    }
  }
  return rows.length
}
