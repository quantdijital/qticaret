import type {
  FilterableCartProps,
  ICartModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { RETENTION_DAYS, cutoffOf } from "../../lib/compliance/retention"
import { CART_REMINDERS_MODULE } from "../../modules/cart-reminders"
import type CartRemindersModuleService from "../../modules/cart-reminders/service"
import { CONVERSIONS_MODULE } from "../../modules/conversions"
import type ConversionsModuleService from "../../modules/conversions/service"
import { PAYMENT_FORMS_MODULE } from "../../modules/payment-forms"
import type PaymentFormsModuleService from "../../modules/payment-forms/service"
import { PAYMENT_RECOVERY_MODULE } from "../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../modules/payment-recovery/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ReturnsSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { TRAFFIC_SOURCES_MODULE } from "../../modules/traffic-sources"
import type TrafficSourcesModuleService from "../../modules/traffic-sources/service"
import { orderedCarts } from "./retention"

type Container = Pick<MedusaContainer, "resolve">

const BATCH = 500
// A night's work at most; a larger backlog is finished the nights after
const MAX_BATCHES = 40

/**
 * Of these carts, the ones with a money trail: a payment made (Medusa's),
 * money taken for no order, or a hosted form still open. Every row read:
 * a page cut short would let a cart with money go.
 */
async function paymentCarts(container: Container, cartIds: string[]): Promise<Set<string>> {
  const [recoveries, forms, paid] = await Promise.all([
    container
      .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
      .listPaymentRecoveries({ cart_id: cartIds }, { select: ["cart_id"], take: null }),
    container
      .resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE)
      .listPaymentForms({ cart_id: cartIds, status: "open" }, { select: ["cart_id"], take: null }),
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "payment_collection.payments.id"],
      filters: { id: cartIds },
    }),
  ])
  const withPayment = (
    paid.data as { id: string; payment_collection?: { payments?: unknown[] | null } | null }[]
  ).flatMap((cart) => ((cart.payment_collection?.payments ?? []).length > 0 ? [cart.id] : []))
  return new Set([
    ...withPayment,
    ...[...recoveries, ...forms].flatMap((row) => (row.cart_id ? [row.cart_id] : [])),
  ])
}

/**
 * Deletes a cart that never became an order, long after it was last
 * touched (docs/kvkk-envanter.md): its e-mail and addresses with it, and
 * the reminder and traffic source kept against it. A cart money was
 * taken for (an orphan payment) or with a hosted form still open stays:
 * its trail is the money's. Its consents went at 30 days already.
 */
export async function forgetAbandonedCartContacts(container: Container, now: Date) {
  const carts = container.resolve<ICartModuleService>(Modules.CART)
  const reminders = container.resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
  const sources = container.resolve<TrafficSourcesModuleService>(TRAFFIC_SOURCES_MODULE)
  const cutoff = cutoffOf(RETENTION_DAYS.abandonedCartContact, now)
  let after = ""
  let deleted = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // By id: carts kept (an order's, a payment's) are stepped over, never read again
    const rows = await carts.listCarts(
      // The module filters on any column; its published type names a few
      {
        completed_at: null,
        updated_at: { $lt: cutoff },
        id: { $gt: after },
      } as unknown as FilterableCartProps,
      { select: ["id"], take: BATCH, order: { id: "ASC" } }
    )
    const ids = rows.map((row) => row.id)
    const [ordered, paid] = ids.length
      ? await Promise.all([orderedCarts(container, ids), paymentCarts(container, ids)])
      : [new Set<string>(), new Set<string>()]
    const due = ids.filter((id) => !ordered.has(id) && !paid.has(id))
    if (due.length > 0) {
      const [reminded, sourced] = await Promise.all([
        reminders.listCartReminders({ cart_id: due }, { select: ["id"], take: null }),
        sources.listTrafficSourceRecords({ cart_id: due }, { select: ["id"], take: null }),
      ])
      await reminders.deleteCartReminders(reminded.map((row) => row.id))
      await sources.deleteTrafficSourceRecords(sourced.map((row) => row.id))
      await carts.deleteCarts(due)
      deleted += due.length
    }
    after = rows.at(-1)?.id ?? after
    if (rows.length < BATCH) {
      break
    }
  }
  return deleted
}

/**
 * Drops the GA client id once no return can send its event any more
 * (docs/kvkk-envanter.md): the shop's return window, counted from the
 * order's day, and a margin for the parcel's way and the refund after.
 */
export async function forgetGaClients(container: Container, now: Date) {
  const { values } = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("returns")
  const days =
    (values as unknown as ReturnsSettings).withdrawal_days + RETENTION_DAYS.gaClientMargin
  return container
    .resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
    .forgetGaClients(cutoffOf(days, now), BATCH * MAX_BATCHES)
}

/** Medusa's notification records beyond its published interface (2.21.2, generated by MedusaService). */
interface NotificationRows {
  listNotifications: (
    filters: { channel: string[]; created_at: { $lt: Date } },
    config: { select: string[]; take: number }
  ) => Promise<{ id: string }[]>
  deleteNotifications: (ids: string[]) => Promise<void>
}

/**
 * Deletes the record of an e-mail or SMS sent, its recipient with it,
 * after the period its proof is kept (docs/kvkk-envanter.md). Medusa keeps
 * the address and ids, never the text (checked 2026-10-31: the table has
 * no column for it). The panel's own alerts are not messages to a person.
 */
export async function forgetSentMessages(container: Container, now: Date) {
  const rows = container.resolve(Modules.NOTIFICATION) as unknown as NotificationRows
  const cutoff = cutoffOf(RETENTION_DAYS.sentMessage, now)
  let deleted = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const old = await rows.listNotifications(
      { channel: ["email", "sms"], created_at: { $lt: cutoff } },
      { select: ["id"], take: BATCH }
    )
    if (old.length > 0) {
      await rows.deleteNotifications(old.map((row) => row.id))
      deleted += old.length
    }
    if (old.length < BATCH) {
      break
    }
  }
  return deleted
}
