import { createHash, randomBytes } from "node:crypto"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { CartReminder } from "./models/cart-reminder"

/** How long the reminder's link opens the cart. */
export const CART_RETURN_DAYS = 7
const RETURN_MS = CART_RETURN_DAYS * 24 * 60 * 60 * 1000

/** What a send came to that uses the cart's one reminder for good (deliver()'s outcomes). */
const FINAL_OUTCOMES: readonly string[] = [
  "sent",
  "duplicate",
  "no_consent",
  "suppressed",
  "invalid_recipient",
]

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex")

/** Abandoned cart reminders (F10.7, adr/0038 §1): one per cart, its link opening the cart once. */
class CartRemindersModuleService extends MedusaService({ CartReminder }) {
  /** Claims the cart's one reminder with a new link token; null when the cart has had it. */
  async claim(cartId: string): Promise<{ id: string; token: string } | null> {
    const token = randomBytes(32).toString("base64url")
    try {
      const reminder = await this.createCartReminders({
        cart_id: cartId,
        outcome: "pending",
        token_hash: tokenHash(token),
        expires_at: new Date(Date.now() + RETURN_MS),
      })
      return { id: reminder.id, token }
    } catch (error) {
      if (uniqueViolationKeys(error)?.includes("cart_id")) {
        return null
      }
      throw error
    }
  }

  /**
   * Records what the send came to. Sent: its link stands. Not sent for
   * good (no consent, suppressed): the reminder is used and its link
   * dropped. Not sent for now (the channel off, the day's quota, a
   * provider's failure): the claim goes, and a later run tries again.
   */
  async settle(id: string, outcome: string): Promise<void> {
    if (outcome === "sent") {
      await this.updateCartReminders({ id, outcome })
    } else if (FINAL_OUTCOMES.includes(outcome)) {
      await this.updateCartReminders({ id, outcome, token_hash: null, expires_at: null })
    } else {
      await this.deleteCartReminders(id)
    }
  }

  /** The cart the e-mail's link opens, once; null for a token unknown, used or past its end. */
  @InjectTransactionManager()
  async redeem(
    token: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ cart_id: string } | null> {
    const [reminder] = await this.listCartReminders(
      { token_hash: tokenHash(token) },
      { take: 1 },
      sharedContext
    )
    if (!reminder?.expires_at || new Date(reminder.expires_at) < new Date()) {
      return null
    }
    await this.updateCartReminders(
      { id: reminder.id, token_hash: null, expires_at: null, returned_at: new Date() },
      sharedContext
    )
    return { cart_id: reminder.cart_id }
  }

  /** The reminders sent since then: how many, how many led back, and their carts. */
  @InjectManager()
  async sentSince(
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ sent: number; returned: number; cart_ids: string[] }> {
    const [rows, sent] = await this.listAndCountCartReminders(
      { outcome: "sent", created_at: { $gte: since } },
      { select: ["cart_id", "returned_at"], take: 10_000 },
      sharedContext
    )
    return {
      sent,
      returned: rows.filter((row) => row.returned_at !== null).length,
      cart_ids: rows.map((row) => row.cart_id),
    }
  }
}

export default CartRemindersModuleService
