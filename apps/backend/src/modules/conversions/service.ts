import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, parseKey } from "@qticaret/server-kit"
import type { ConversionClient } from "../../lib/conversions/events"
import { uniqueViolationKeys } from "../../lib/errors"
import { ConversionEvent } from "./models/conversion-event"
import { TrackingConsent } from "./models/tracking-consent"

export interface ConversionsOptions {
  encryptionKey: string
}

export interface TrackingInput {
  analytics: boolean
  marketing: boolean
  ga_client_id?: string | null | undefined
  fbp?: string | null | undefined
  fbc?: string | null | undefined
  page_url?: string | null | undefined
  ip?: string | null | undefined
  user_agent?: string | null | undefined
  /** The visitor's cookie consent the answer was held to (F13.8). */
  cookie_consent_id?: string | null | undefined
}

const CONTEXT = "conversions.client"

/** The shopper's measurement consent per cart and order, and the events sent (F10.9). */
class ConversionsModuleService extends MedusaService({ TrackingConsent, ConversionEvent }) {
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: ConversionsOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.encryptionKey = parseKey(options.encryptionKey, "conversions encryptionKey")
  }

  /**
   * The cookie banner's answer for the cart; sent again, the last counts.
   * Without marketing consent nothing Meta reads is kept; without either,
   * nothing that names the browser.
   */
  async recordCart(cartId: string, input: TrackingInput): Promise<void> {
    try {
      await this.recordCart_(cartId, input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("cart_id")) {
        throw error
      }
      await this.recordCart_(cartId, input)
    }
  }

  @InjectTransactionManager()
  protected async recordCart_(
    cartId: string,
    input: TrackingInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const marketing = input.marketing
    const client =
      marketing && (input.ip || input.user_agent)
        ? encryptPii(
            JSON.stringify({ ip: input.ip ?? null, userAgent: input.user_agent ?? null }),
            this.encryptionKey,
            CONTEXT
          )
        : null
    const values = {
      analytics: input.analytics,
      marketing,
      given_at: new Date(),
      ga_client_id: input.analytics ? (input.ga_client_id ?? null) : null,
      fbp: marketing ? (input.fbp ?? null) : null,
      fbc: marketing ? (input.fbc ?? null) : null,
      page_url: input.analytics || marketing ? (input.page_url ?? null) : null,
      client_encrypted: client,
      cookie_consent_id: input.cookie_consent_id ?? null,
    }
    const [row] = await this.listTrackingConsents({ cart_id: cartId }, { take: 1 }, sharedContext)
    if (row) {
      await this.updateTrackingConsents({ id: row.id, ...values }, sharedContext)
    } else {
      await this.createTrackingConsents({ cart_id: cartId, ...values }, sharedContext)
    }
  }

  /** The cart's answer becomes the order's (once it is one); null when it gave none. */
  @InjectTransactionManager()
  async moveToOrder(
    cartId: string,
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listTrackingConsents({ cart_id: cartId }, { take: 1 }, sharedContext)
    if (row) {
      await this.updateTrackingConsents(
        { id: row.id, cart_id: null, order_id: orderId },
        sharedContext
      )
    }
  }

  /**
   * Holds the order's consent to the answer in force (F13.8): what it no
   * longer allows goes, the GA4 id with analytics and Meta's details with
   * marketing, so no later event reads more.
   */
  @InjectTransactionManager()
  async holdOrderTo(
    orderId: string,
    flags: { analytics: boolean; marketing: boolean },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listTrackingConsents({ order_id: orderId }, { take: 1 }, sharedContext)
    if (!row || (row.analytics === flags.analytics && row.marketing === flags.marketing)) {
      return
    }
    await this.updateTrackingConsents(
      {
        id: row.id,
        analytics: flags.analytics,
        marketing: flags.marketing,
        ...(flags.analytics ? {} : { ga_client_id: null }),
        ...(flags.marketing ? {} : { fbp: null, fbc: null, client_encrypted: null }),
        ...(flags.analytics || flags.marketing ? {} : { page_url: null }),
      },
      sharedContext
    )
  }

  /** The order's consent, with the browser's details decrypted to send; null without one. */
  @InjectManager()
  async ofOrder(
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{
    analytics: boolean
    marketing: boolean
    gaClientId: string | null
    client: ConversionClient
    cookieConsentId: string | null
  } | null> {
    const [row] = await this.listTrackingConsents({ order_id: orderId }, { take: 1 }, sharedContext)
    if (!row) {
      return null
    }
    const opened = row.client_encrypted
      ? (JSON.parse(decryptPii(row.client_encrypted, this.encryptionKey, CONTEXT)) as {
          ip: string | null
          userAgent: string | null
        })
      : { ip: null, userAgent: null }
    return {
      analytics: row.analytics,
      marketing: row.marketing,
      gaClientId: row.ga_client_id,
      client: { ...opened, fbp: row.fbp, fbc: row.fbc, pageUrl: row.page_url },
      cookieConsentId: row.cookie_consent_id,
    }
  }

  /** Drops the browser's details of orders whose events went (or long ago). */
  @InjectTransactionManager()
  async forgetClients(
    orderIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const rows = await this.listTrackingConsents(
      { order_id: orderIds },
      { select: ["id"] },
      sharedContext
    )
    for (const row of rows) {
      await this.updateTrackingConsents(
        { id: row.id, client_encrypted: null, fbc: null, fbp: null, page_url: null },
        sharedContext
      )
    }
  }

  /** Drops the browser's details kept longer than any retry needs them. */
  @InjectTransactionManager()
  async forgetStaleClients(
    before: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const rows = await this.listTrackingConsents(
      { client_encrypted: { $ne: null }, created_at: { $lt: before } },
      { select: ["id"] },
      sharedContext
    )
    for (const row of rows) {
      await this.updateTrackingConsents(
        { id: row.id, client_encrypted: null, fbc: null, fbp: null, page_url: null },
        sharedContext
      )
    }
    return rows.length
  }

  /**
   * Drops the GA client id once no return can send its event any more
   * (docs/kvkk-envanter.md): the rest of the consent stays, the order's.
   */
  @InjectTransactionManager()
  async forgetGaClients(
    before: Date,
    limit: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const rows = await this.listTrackingConsents(
      { ga_client_id: { $ne: null }, created_at: { $lt: before } },
      { select: ["id"], take: limit },
      sharedContext
    )
    for (const row of rows) {
      await this.updateTrackingConsents({ id: row.id, ga_client_id: null }, sharedContext)
    }
    return rows.length
  }

  /**
   * Claims an event before it is sent: Medusa's bus may deliver one event
   * twice at once, and only the delivery whose row goes in sends it. A
   * failed event, or one left pending by a delivery that died, may be
   * claimed again; one sent may not.
   */
  async claimEvent(input: {
    key: string
    target: string
    kind: string
    order_id: string
    amount?: number | null | undefined
  }): Promise<boolean> {
    try {
      await this.createConversionEvents({
        event_key: input.key,
        target: input.target,
        kind: input.kind,
        order_id: input.order_id,
        amount: input.amount ?? null,
        status: "pending",
        attempts: 1,
      })
      return true
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("event_key")) {
        throw error
      }
    }
    return this.reclaim_(input.key)
  }

  // One statement: of two deliveries trying again at once, one updates the row
  @InjectTransactionManager()
  protected async reclaim_(
    key: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("conversions: an event is claimed in a transaction")
    }
    const rows: unknown[] = await manager.execute(
      `UPDATE conversion_event SET status = 'pending', attempts = attempts + 1, updated_at = now()
       WHERE event_key = ? AND deleted_at IS NULL
         AND (status = 'failed' OR (status = 'pending' AND updated_at < now() - interval '10 minutes'))
       RETURNING id`,
      [key]
    )
    return rows.length > 0
  }

  /** What the claimed event came to. */
  @InjectTransactionManager()
  async settleEvent(
    key: string,
    error: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listConversionEvents(
      { event_key: key },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (row) {
      await this.updateConversionEvents(
        {
          id: row.id,
          status: error ? "failed" : "sent",
          error,
          sent_at: error ? null : new Date(),
        },
        sharedContext
      )
    }
  }
}

export default ConversionsModuleService
