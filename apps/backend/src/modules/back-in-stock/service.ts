import { createHash, randomBytes } from "node:crypto"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey } from "@qticaret/server-kit"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import { StockAlert } from "./models/stock-alert"

export interface BackInStockOptions {
  hashKey: string
  encryptionKey: string
}

/** How long a guest has to confirm an alert from the e-mail. */
const CONFIRM_MS = 24 * 60 * 60 * 1000

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex")

export interface SubscribeInput {
  variant_id: string
  product_id: string
  email: string
  customer_id: string | null
  /** A signed-in customer's own address: no confirmation needed. */
  confirmed: boolean
}

/** Stock alerts (F10.5, adr/0037 §4): who waits for which variant, each told once. */
class BackInStockModuleService extends MedusaService({ StockAlert }) {
  private readonly hashKey: Buffer
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: BackInStockOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "back-in-stock hashKey")
    this.encryptionKey = parseKey(options.encryptionKey, "back-in-stock encryptionKey")
  }

  /**
   * Starts waiting for the variant, or waits again after a notice or a
   * cancel. A guest's alert stays pending until confirmed: the token comes
   * back once, for the confirmation e-mail.
   */
  async subscribe(
    input: SubscribeInput
  ): Promise<{ id: string; status: string; token: string | null }> {
    try {
      return await this.subscribe_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("variant_id")) {
        throw error
      }
      return this.subscribe_(input)
    }
  }

  @InjectTransactionManager()
  protected async subscribe_(
    input: SubscribeInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; status: string; token: string | null }> {
    const email = normalizeRecipient("email", input.email)
    if (!email) {
      throw new ValidationError("messaging.recipient_invalid", { field: "email" })
    }
    const emailHash = hashPii(email, this.hashKey, "back-in-stock.email")
    const [existing] = await this.listStockAlerts(
      { variant_id: input.variant_id, email_hash: emailHash },
      { take: 1 },
      sharedContext
    )
    // Waiting already, or a guest's confirmation still on its way: nothing to send again
    const confirming =
      existing?.status === "pending" &&
      !input.confirmed &&
      existing.confirm_expires_at !== null &&
      new Date(existing.confirm_expires_at) > new Date()
    if (existing && (existing.status === "active" || confirming)) {
      return { id: existing.id, status: existing.status, token: null }
    }
    const token = input.confirmed ? null : randomBytes(32).toString("base64url")
    const values = {
      status: input.confirmed ? ("active" as const) : ("pending" as const),
      customer_id: input.customer_id ?? existing?.customer_id ?? null,
      confirm_token_hash: token ? tokenHash(token) : null,
      confirm_expires_at: token ? new Date(Date.now() + CONFIRM_MS) : null,
      notified_at: null,
    }
    const alert = existing
      ? await this.updateStockAlerts({ id: existing.id, ...values }, sharedContext)
      : await this.createStockAlerts(
          {
            variant_id: input.variant_id,
            product_id: input.product_id,
            email_hash: emailHash,
            email_encrypted: encryptPii(email, this.encryptionKey, "back-in-stock.email"),
            email_masked: maskRecipient("email", email),
            ...values,
          },
          sharedContext
        )
    return { id: alert.id, status: alert.status, token }
  }

  /** Opens a guest's alert from the e-mail's link; null for a token unknown, used or late. */
  @InjectTransactionManager()
  async confirm(
    token: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string } | null> {
    const [alert] = await this.listStockAlerts(
      { confirm_token_hash: tokenHash(token), status: "pending" },
      { take: 1 },
      sharedContext
    )
    if (!alert?.confirm_expires_at || new Date(alert.confirm_expires_at) < new Date()) {
      return null
    }
    await this.updateStockAlerts(
      { id: alert.id, status: "active", confirm_token_hash: null, confirm_expires_at: null },
      sharedContext
    )
    return { id: alert.id }
  }

  /** The address to write to: decrypted only to send. */
  @InjectManager()
  async addressOf(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [alert] = await this.listStockAlerts(
      { id },
      { take: 1, select: ["email_encrypted"] },
      sharedContext
    )
    return alert
      ? decryptPii(alert.email_encrypted, this.encryptionKey, "back-in-stock.email")
      : null
  }
}

export default BackInStockModuleService
