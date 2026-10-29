import type {
  FilterableCartProps,
  FilterableOrderProps,
  MedusaContainer,
} from "@medusajs/framework/types"
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

/** Carts read at a time, and at most this many a run, however few qualify. */
const SCAN_PAGE = 200
const SCAN_MAX = 5_000
/** One reminder an address in this long, however many carts it leaves behind. */
const PER_ADDRESS_MS = OLDEST_MS

type Container = Pick<MedusaContainer, "resolve">

/** Whether another cart of the address got its reminder lately (security review 2026-10-29). */
async function remindedLately(container: Container, cart: CandidateCart, now: number) {
  const others = await container.resolve(Modules.CART).listCarts(
    cartFilter({
      email: cart.email,
      id: { $ne: cart.id },
      updated_at: { $gt: new Date(now - OLDEST_MS - PER_ADDRESS_MS).toISOString() },
    }),
    { select: ["id"], take: 50, order: { updated_at: "DESC" } }
  )
  if (others.length === 0) {
    return false
  }
  const [recent] = await container
    .resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
    .listCartReminders(
      {
        cart_id: others.map((other) => other.id),
        outcome: ["sent", "pending"],
        created_at: { $gt: new Date(now - PER_ADDRESS_MS) },
      },
      { select: ["id"], take: 1 }
    )
  return recent !== undefined
}

/**
 * Carts left behind (adr/0038 §1): with an e-mail and lines, unchanged
 * for the shop's delay but not for a week, not reminded yet, and whose
 * shopper has placed no order since. Read page by page until the run's
 * limit is filled, so carts that do not qualify cannot crowd out those
 * that do; one cart an address, and none for an address reminded within
 * the week.
 */
const findAbandonedCartsStep = createStep(
  "marketing-find-abandoned-carts",
  async (input: { delay_minutes: number; limit: number }, { container }) => {
    const now = Date.now()
    const carts = container.resolve(Modules.CART)
    const orders = container.resolve(Modules.ORDER)
    const reminders = container.resolve<CartRemindersModuleService>(CART_REMINDERS_MODULE)
    const ids: string[] = []
    const addresses = new Set<string>()
    for (let skip = 0; ids.length < input.limit && skip < SCAN_MAX; skip += SCAN_PAGE) {
      const page = (await carts.listCarts(
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
          take: SCAN_PAGE,
          skip,
          order: { updated_at: "ASC" },
        }
      )) as CandidateCart[]
      const withLines = page.filter((cart) => (cart.items?.length ?? 0) > 0 && cart.email)
      const reminded = new Set(
        (
          await reminders.listCartReminders(
            { cart_id: withLines.map((cart) => cart.id) },
            { select: ["cart_id"], take: withLines.length }
          )
        ).map((row) => row.cart_id)
      )
      for (const cart of withLines) {
        const address = (cart.email ?? "").trim().toLocaleLowerCase("tr")
        if (ids.length >= input.limit) {
          break
        }
        if (reminded.has(cart.id) || addresses.has(address)) {
          continue
        }
        const [later] = await orders.listOrders(
          orderFilter({
            email: cart.email,
            created_at: { $gt: new Date(cart.updated_at).toISOString() },
          }),
          { select: ["id"], take: 1 }
        )
        if (!later && !(await remindedLately(container, cart, now))) {
          addresses.add(address)
          ids.push(cart.id)
        }
      }
      if (page.length < SCAN_PAGE) {
        break
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
