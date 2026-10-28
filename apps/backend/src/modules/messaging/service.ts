import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { hashPii, parseKey } from "../../lib/crypto/pii"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { MessageConsent } from "./models/message-consent"
import { MessageConsentEvent } from "./models/message-consent-event"
import { MessageSuppression } from "./models/message-suppression"

export interface MessagingModuleOptions {
  /** 64 hex characters (PII_HASH_KEY): addresses are kept only as this keyed hash. */
  hashKey: string
}

export type ConsentChannel = MessageChannel | "call"
export type ConsentStatus = "granted" | "revoked"
export type ConsentSource = "checkout" | "account" | "panel" | "import" | "iys"

export interface ConsentInput {
  channel: ConsentChannel
  address: string
  status: ConsentStatus
  source: ConsentSource
  customer_id?: string | null
  /** The staff member, when the panel changed it. */
  changed_by?: string | null
}

export interface SuppressionInput {
  channel: MessageChannel
  address: string
  reason: "bounce" | "complaint" | "manual"
  source: "resend" | "netgsm" | "panel"
  detail?: string | null
  created_by?: string | null
}

/** A call's consent is kept against the phone number, like an SMS's. */
const addressChannel = (channel: ConsentChannel): MessageChannel =>
  channel === "email" ? "email" : "sms"

/**
 * Who takes which messages (adr/0036): commercial consent per channel,
 * with its history, and the addresses nothing goes to. An address is
 * stored only as a keyed hash and a masked form; plaintext never reaches
 * the database or an error.
 */
class MessagingModuleService extends MedusaService({
  MessageConsent,
  MessageConsentEvent,
  MessageSuppression,
}) {
  private readonly hashKey: Buffer

  constructor(container: Record<string, unknown>, options: MessagingModuleOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "messaging hashKey")
  }

  /** The recipient as the records find it; null when the address is none of the channel's. */
  recipientOf(channel: ConsentChannel, address: string): { hash: string; masked: string } | null {
    const kind = addressChannel(channel)
    const normalized = normalizeRecipient(kind, address)
    return normalized
      ? {
          hash: hashPii(normalized, this.hashKey, `messaging.${kind}`),
          masked: maskRecipient(kind, normalized),
        }
      : null
  }

  private requireRecipient(channel: ConsentChannel, address: string) {
    const recipient = this.recipientOf(channel, address)
    if (!recipient) {
      throw new ValidationError("messaging.recipient_invalid", { field: "address" })
    }
    return recipient
  }

  /** The recipient's answer on the channel; null when it never gave one. */
  @InjectManager()
  async consentOf(
    channel: ConsentChannel,
    address: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ConsentStatus | null> {
    const recipient = this.recipientOf(channel, address)
    if (!recipient) {
      return null
    }
    const [row] = await this.listMessageConsents(
      { channel, recipient_hash: recipient.hash },
      { take: 1 },
      sharedContext
    )
    return row?.status ?? null
  }

  /**
   * Gives or withdraws consent. A change is kept as an event; the same
   * answer again changes nothing. Two first answers racing store one row.
   */
  async recordConsent(input: ConsentInput): Promise<{ id: string; changed: boolean }> {
    try {
      return await this.recordConsent_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("recipient_hash")) {
        throw error
      }
      return this.recordConsent_(input)
    }
  }

  @InjectTransactionManager()
  protected async recordConsent_(
    input: ConsentInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; changed: boolean }> {
    const recipient = this.requireRecipient(input.channel, input.address)
    const [row] = await this.listMessageConsents(
      { channel: input.channel, recipient_hash: recipient.hash },
      { take: 1 },
      sharedContext
    )
    if (row?.status === input.status) {
      return { id: row.id, changed: false }
    }
    const now = new Date()
    const values = {
      status: input.status,
      source: input.source,
      changed_at: now,
      changed_by: input.changed_by ?? null,
      // İYS hears of every change (F10); a customer's own record moves with it
      iys_status: "pending" as const,
      ...(input.customer_id ? { customer_id: input.customer_id } : {}),
    }
    const consent = row
      ? await this.updateMessageConsents({ id: row.id, ...values }, sharedContext)
      : await this.createMessageConsents(
          {
            channel: input.channel,
            recipient_hash: recipient.hash,
            recipient_masked: recipient.masked,
            customer_id: input.customer_id ?? null,
            ...values,
          },
          sharedContext
        )
    await this.createMessageConsentEvents(
      {
        consent_id: consent.id,
        channel: input.channel,
        status: input.status,
        source: input.source,
        changed_at: now,
        changed_by: input.changed_by ?? null,
      },
      sharedContext
    )
    return { id: consent.id, changed: true }
  }

  /** Whether nothing may go to the address on the channel. */
  @InjectManager()
  async isSuppressed(
    channel: MessageChannel,
    address: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const recipient = this.recipientOf(channel, address)
    if (!recipient) {
      return false
    }
    const [row] = await this.listMessageSuppressions(
      { channel, recipient_hash: recipient.hash },
      { take: 1, select: ["id"] },
      sharedContext
    )
    return row !== undefined
  }

  /** Puts the address on the list; already there keeps the first reason. */
  async suppress(input: SuppressionInput): Promise<{ id: string; created: boolean }> {
    try {
      return await this.suppress_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("recipient_hash")) {
        throw error
      }
      return this.suppress_(input)
    }
  }

  @InjectTransactionManager()
  protected async suppress_(
    input: SuppressionInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; created: boolean }> {
    const recipient = this.requireRecipient(input.channel, input.address)
    const [row] = await this.listMessageSuppressions(
      { channel: input.channel, recipient_hash: recipient.hash },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (row) {
      return { id: row.id, created: false }
    }
    const created = await this.createMessageSuppressions(
      {
        channel: input.channel,
        recipient_hash: recipient.hash,
        recipient_masked: recipient.masked,
        reason: input.reason,
        source: input.source,
        detail: input.detail?.slice(0, 40) ?? null,
        created_by: input.created_by ?? null,
      },
      sharedContext
    )
    return { id: created.id, created: true }
  }

  /** Takes the address off the list, keeping who did it; messages may go to it again. */
  @InjectTransactionManager()
  async unsuppress(
    id: string,
    removedBy: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.updateMessageSuppressions({ id, removed_by: removedBy }, sharedContext)
    await this.softDeleteMessageSuppressions([id], {}, sharedContext)
  }
}

export default MessagingModuleService
