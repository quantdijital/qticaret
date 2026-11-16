import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey } from "@qticaret/server-kit"
import { normalizeRecipient } from "../../lib/messaging/recipients"
import { paymentLinkTokenHash } from "../../lib/payment-links/token"
import { PaymentLink } from "./models/payment-link"

export interface PaymentLinksOptions {
  hashKey: string
  encryptionKey: string
}

/** Who the link is for, as staff entered it or the customer's record had it. */
export interface PaymentLinkContact {
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

/** A preset delivery address, as a cart takes it (Turkish fields, adr/0007). */
export interface PaymentLinkAddress {
  first_name: string
  last_name: string
  phone: string | null
  address_1: string
  address_2: string | null
  city: string
  province: string
  postal_code: string | null
  country_code: string
}

/** What a link keeps sealed. */
export interface PaymentLinkPrivate {
  contact: PaymentLinkContact
  address: PaymentLinkAddress | null
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * How long a completion's hold on its link lasts. Medusa's completion runs
 * in seconds under the cart's lock; a hold left by a process that died
 * halfway frees itself after this, and a cart of the link that did become
 * an order still refuses every other (`completedLinkCarts`).
 */
export const CLAIM_TTL_MS = 15 * 60 * 1000

const SEAL = "payment-links.private"
const TOKEN_SEAL = "payment-links.token"
const HASH = "payment-links.email"

/**
 * Payment links (adr/0051 §1): kept with their contact sealed and their
 * token as a hash. Everything else is Medusa's generated CRUD; the
 * workflows decide what changes when.
 */
class PaymentLinksModuleService extends MedusaService({ PaymentLink }) {
  private readonly hashKey: Buffer
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: PaymentLinksOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "payment-links hashKey")
    this.encryptionKey = parseKey(options.encryptionKey, "payment-links encryptionKey")
  }

  /** The keyed hash a person's address finds their links by; null for none. */
  emailHashOf(email: string | null | undefined): string | null {
    const normalized = email ? normalizeRecipient("email", email) : null
    return normalized ? hashPii(normalized, this.hashKey, HASH) : null
  }

  sealPrivate(data: PaymentLinkPrivate): string {
    return encryptPii(JSON.stringify(data), this.encryptionKey, SEAL)
  }

  /** The sealed contact; null once purged, or for a seal that does not open (a changed key). */
  openPrivate(sealed: string | null | undefined): PaymentLinkPrivate | null {
    if (!sealed) {
      return null
    }
    try {
      return JSON.parse(decryptPii(sealed, this.encryptionKey, SEAL)) as PaymentLinkPrivate
    } catch {
      return null
    }
  }

  sealToken(token: string): string {
    return encryptPii(token, this.encryptionKey, TOKEN_SEAL)
  }

  openToken(sealed: string | null | undefined): string | null {
    if (!sealed) {
      return null
    }
    try {
      return decryptPii(sealed, this.encryptionKey, TOKEN_SEAL)
    } catch {
      return null
    }
  }

  /**
   * Holds an open link for one of its carts while that cart becomes its
   * order, in one statement: of two carts (or two notices) completing at
   * once, one holds it and the other is refused, whatever each read before.
   * Only the link's latest cart may hold it; the same cart holds it again
   * (a notice repeated); another cart's hold counts until `CLAIM_TTL_MS`.
   */
  @InjectTransactionManager()
  async claimForCart(
    linkId: string,
    cartId: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE payment_link SET claimed_cart_id = ?, claimed_at = ?, updated_at = now()
        WHERE id = ? AND deleted_at IS NULL AND status = 'open' AND cart_id = ?
          AND (claimed_cart_id IS NULL OR claimed_cart_id = ? OR claimed_at < ?)
       RETURNING id`,
      [cartId, now, linkId, cartId, cartId, new Date(now.getTime() - CLAIM_TTL_MS)]
    )) as unknown[]
    return rows.length > 0
  }

  /** Lets go of a cart's hold (its completion failed); another cart's hold is left. */
  @InjectTransactionManager()
  async releaseClaim(
    linkId: string,
    cartId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE payment_link SET claimed_cart_id = NULL, claimed_at = NULL, updated_at = now()
        WHERE id = ? AND claimed_cart_id = ?`,
      [linkId, cartId]
    )
  }

  /** The link a token names, whatever its state; null for none. */
  async byToken(token: string) {
    const [link] = await this.listPaymentLinks(
      { token_hash: paymentLinkTokenHash(token) },
      { take: 1 }
    )
    return link ?? null
  }
}

export default PaymentLinksModuleService
