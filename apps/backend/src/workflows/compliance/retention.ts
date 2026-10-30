import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RETENTION_DAYS, cutoffOf } from "../../lib/compliance/retention"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { BACK_IN_STOCK_MODULE } from "../../modules/back-in-stock"
import type BackInStockModuleService from "../../modules/back-in-stock/service"
import { CONVERSIONS_MODULE } from "../../modules/conversions"
import type ConversionsModuleService from "../../modules/conversions/service"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

const BATCH = 500

/** Of these carts, the ones that became an order: their records are the order's evidence. */
async function orderedCarts(container: Container, cartIds: string[]): Promise<Set<string>> {
  if (cartIds.length === 0) {
    return new Set()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "order.id"],
    filters: { id: cartIds },
  })
  return new Set(
    (data as { id: string; order?: { id: string } | null }[]).flatMap((cart) =>
      cart.order?.id ? [cart.id] : []
    )
  )
}

/** A store of cart-held records: the old ones, and how to delete some. */
interface CartRecords {
  name: string
  old: (cutoff: Date) => Promise<{ id: string; cart_id: string | null }[]>
  remove: (ids: string[]) => Promise<void>
}

function cartRecordStores(container: Container): CartRecords[] {
  const legal = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const conversions = container.resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
  const page = { select: ["id", "cart_id"], take: BATCH }
  return [
    {
      name: "legal_consent",
      old: (cutoff) => legal.listLegalConsents({ order_id: null, given_at: { $lt: cutoff } }, page),
      remove: (ids) => legal.deleteLegalConsents(ids),
    },
    {
      name: "age_declaration",
      old: (cutoff) => legal.listAgeDeclarations({ declared_at: { $lt: cutoff } }, page),
      remove: (ids) => legal.deleteAgeDeclarations(ids),
    },
    {
      name: "checkout_consent",
      old: (cutoff) => messaging.listCheckoutConsents({ given_at: { $lt: cutoff } }, page),
      remove: (ids) => messaging.deleteCheckoutConsents(ids),
    },
    {
      name: "tracking_consent",
      old: (cutoff) =>
        conversions.listTrackingConsents(
          { cart_id: { $ne: null }, order_id: null, given_at: { $lt: cutoff } },
          page
        ),
      remove: (ids) => conversions.deleteTrackingConsents(ids),
    },
  ]
}

/**
 * Deletes what a cart that never became an order still holds of its
 * shopper (adr/0041 §6): consents, the age declaration, measurement
 * consent. A cart that did become an order keeps them: they are its proof.
 */
export async function forgetAbandonedCarts(
  container: Container,
  now: Date
): Promise<Record<string, number>> {
  const cutoff = cutoffOf(RETENTION_DAYS.abandonedCart, now)
  const deleted: Record<string, number> = {}
  for (const store of cartRecordStores(container)) {
    const rows = await store.old(cutoff)
    const ordered = await orderedCarts(
      container,
      rows.flatMap((row) => (row.cart_id ? [row.cart_id] : []))
    )
    const due = rows.filter((row) => !row.cart_id || !ordered.has(row.cart_id))
    if (due.length > 0) {
      await store.remove(due.map((row) => row.id))
    }
    deleted[store.name] = due.length
  }
  return deleted
}

/** Deletes cookie banner answers older than the proof is kept (adr/0041 §5). */
export async function forgetOldCookieConsents(container: Container, now: Date): Promise<number> {
  const legal = container.resolve<LegalModuleService>(LEGAL_MODULE)
  const old = await legal.listCookieConsents(
    { given_at: { $lt: cutoffOf(RETENTION_DAYS.cookieConsent, now) } },
    { select: ["id"], take: BATCH }
  )
  if (old.length > 0) {
    await legal.deleteCookieConsents(old.map((row) => row.id))
  }
  return old.length
}

/** Clears the IP address and browser of audit entries past their period (adr/0011). */
export async function forgetAuditClients(container: Container, now: Date): Promise<number> {
  return container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .forgetClients(cutoffOf(RETENTION_DAYS.auditClient, now))
}

/**
 * Deletes stock alerts that are done with their address: notified or
 * cancelled long ago, or a guest's that was never confirmed.
 */
export async function forgetSettledStockAlerts(container: Container, now: Date): Promise<number> {
  const alerts = container.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
  const cutoff = cutoffOf(RETENTION_DAYS.stockAlert, now)
  const [settled, unconfirmed] = await Promise.all([
    alerts.listStockAlerts(
      { status: ["notified", "cancelled"], updated_at: { $lt: cutoff } },
      { select: ["id"], take: BATCH }
    ),
    alerts.listStockAlerts(
      { status: "pending", confirm_expires_at: { $lt: cutoff } },
      { select: ["id"], take: BATCH }
    ),
  ])
  const ids = [...settled, ...unconfirmed].map((alert) => alert.id)
  if (ids.length > 0) {
    await alerts.deleteStockAlerts(ids)
  }
  return ids.length
}

/** Deletes double opt-in requests a while after their link expired, confirmed or not. */
export async function forgetSpentConsentRequests(container: Container, now: Date): Promise<number> {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const spent = await messaging.listConsentRequests(
    { expires_at: { $lt: cutoffOf(RETENTION_DAYS.consentRequest, now) } },
    { select: ["id"], take: BATCH }
  )
  if (spent.length > 0) {
    await messaging.deleteConsentRequests(spent.map((request) => request.id))
  }
  return spent.length
}
