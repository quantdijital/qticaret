import type { FilterableCartProps, FilterableOrderProps } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { CART_REMINDERS_MODULE } from "../../modules/cart-reminders"
import type CartRemindersModuleService from "../../modules/cart-reminders/service"
import { deliver } from "../messaging/deliver"
import { loadCartReminder } from "../messaging/loaders/cart-reminder"

// Medusa's filter types leave out fields its tables have (an order's e-mail)
// and type a cart's `completed_at` as text; the database takes null and dates
const cartFilter = (filters: Record<string, unknown>) => filters as FilterableCartProps
const orderFilter = (filters: Record<string, unknown>) => filters as FilterableOrderProps

const MINUTE = 60 * 1000
/** A cart older than this is not reminded of: its shopper has moved on. */
const OLDEST_MS = 7 * 24 * 60 * MINUTE

interface CandidateCart {
  id: string
  email: string | null
  updated_at: string | Date
  items?: unknown[] | null
}

/**
 * Carts left behind (adr/0038 §1): with an e-mail and lines, unchanged
 * for the shop's delay but not for a week, not reminded yet, and whose
 * shopper has placed no order since.
 */
const findAbandonedCartsStep = createStep(
  "marketing-find-abandoned-carts",
  async (input: { delay_minutes: number; limit: number }, { container }) => {
    const now = Date.now()
    const carts = (await container.resolve(Modules.CART).listCarts(
      cartFilter({
        completed_at: null,
        email: { $ne: null },
        updated_at: {
          $lt: new Date(now - input.delay_minutes * MINUTE).toISOString(),
          $gt: new Date(now - OLDEST_MS).toISOString(),
        },
      }),
      {
        select: ["id", "email", "updated_at"],
        relations: ["items"],
        take: input.limit,
        order: { updated_at: "ASC" },
      }
    )) as CandidateCart[]
    const withLines = carts.filter((cart) => (cart.items?.length ?? 0) > 0 && cart.email)
    const reminded = new Set(
      (
        await container
          .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
          .listCartReminders(
            { cart_id: withLines.map((cart) => cart.id) },
            { select: ["cart_id"], take: withLines.length }
          )
      ).map((row) => row.cart_id)
    )
    const orders = container.resolve(Modules.ORDER)
    const ids: string[] = []
    for (const cart of withLines) {
      if (reminded.has(cart.id)) {
        continue
      }
      const [later] = await orders.listOrders(
        orderFilter({
          email: cart.email,
          created_at: { $gt: new Date(cart.updated_at).toISOString() },
        }),
        { select: ["id"], take: 1 }
      )
      if (!later) {
        ids.push(cart.id)
      }
    }
    return new StepResponse(ids)
  }
)

/** The carts to remind now, oldest first (F10.7). */
export const findAbandonedCartsWorkflow = createWorkflow(
  "marketing-find-abandoned-carts",
  (input: { delay_minutes: number; limit: number }) =>
    new WorkflowResponse(findAbandonedCartsStep(input))
)

/**
 * Claims the cart's one reminder and sends it through deliver(), which
 * checks consent and suppression (KK3); what it came to is recorded. An
 * e-mail cannot be called back: when sending throws, the claim goes so a
 * later run tries again, and nothing else is left to undo.
 */
const remindCartStep = createStep(
  "marketing-remind-cart",
  async (input: { cart_id: string }, { container }) => {
    const reminders = container.resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
    const claimed = await reminders.claim(input.cart_id)
    if (!claimed) {
      return new StepResponse({ outcome: "reminded_already" })
    }
    let outcome = "gone"
    try {
      const loaded = await loadCartReminder(container, input.cart_id, { token: claimed.token })
      if (loaded) {
        const outcomes = await deliver(container, {
          template: "cart.reminder",
          resource: { type: loaded.resourceType, id: input.cart_id },
          recipients: loaded.recipients,
          receiverId: loaded.receiverId,
          vars: loaded.vars,
        })
        outcome = outcomes.email ?? "gone"
      }
    } catch (error) {
      await reminders.deleteCartReminders(claimed.id)
      throw error
    }
    await reminders.settle(claimed.id, outcome)
    return new StepResponse({ outcome })
  }
)

/** One cart's reminder (F10.7, adr/0038 §1). */
export const remindCartWorkflow = createWorkflow(
  "marketing-remind-cart",
  (input: { cart_id: string }) => new WorkflowResponse(remindCartStep(input))
)

/** Opens the cart from a reminder's link, once; a used, late or unknown link opens nothing. */
const redeemCartReminderStep = createStep(
  "marketing-redeem-cart-reminder",
  async (input: { token: string }, { container }) => {
    const redeemed = await container
      .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
      .redeem(input.token)
    const [cart] = redeemed
      ? await container
          .resolve(Modules.CART)
          .listCarts(cartFilter({ id: redeemed.cart_id, completed_at: null }), {
            select: ["id"],
            take: 1,
          })
      : []
    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart_reminders.link_invalid")
    }
    return new StepResponse({ cart_id: cart.id })
  }
)

/** The storefront's return page asks which cart the link opens (adr/0038 §1). */
export const redeemCartReminderWorkflow = createWorkflow(
  "marketing-redeem-cart-reminder",
  (input: { token: string }) => new WorkflowResponse(redeemCartReminderStep(input))
)
