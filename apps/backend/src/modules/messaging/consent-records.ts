import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey } from "../../lib/crypto/pii"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { CheckoutConsent } from "./models/checkout-consent"
import { ConsentRequest } from "./models/consent-request"
import { MessageConsent } from "./models/message-consent"
import { MessageConsentEvent } from "./models/message-consent-event"
import { MessageSkip } from "./models/message-skip"
import { MessageSuppression } from "./models/message-suppression"
import { MessageTemplateText } from "./models/message-template-text"
import { SenderDomain } from "./models/sender-domain"
import type {
  ConsentChannel,
  ConsentEvidence,
  ConsentInput,
  ConsentSource,
  ConsentStatus,
  MessagingModuleOptions,
} from "./types"

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "consent events are append-only")
}

/** A call's consent is kept against the phone number, like an SMS's. */
const addressChannel = (channel: ConsentChannel): MessageChannel =>
  channel === "email" ? "email" : "sms"

/**
 * Commercial consent per channel, with its history (adr/0036): the half
 * of the messaging service that keeps who takes what. An address is
 * stored as a keyed hash and a masked form, and encrypted for İYS alone
 * (F10 M11); plaintext never reaches an error.
 */
export class ConsentRecords extends MedusaService({
  CheckoutConsent,
  ConsentRequest,
  MessageConsent,
  MessageConsentEvent,
  MessageSkip,
  MessageSuppression,
  MessageTemplateText,
  SenderDomain,
}) {
  protected readonly hashKey: Buffer
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: MessagingModuleOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "messaging hashKey")
    this.encryptionKey = parseKey(options.encryptionKey, "messaging encryptionKey")
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

  protected requireRecipient(channel: ConsentChannel, address: string) {
    const recipient = this.recipientOf(channel, address)
    if (!recipient) {
      throw new ValidationError("messaging.recipient_invalid", { field: "address" })
    }
    const normalized = normalizeRecipient(addressChannel(channel), address) ?? ""
    return {
      ...recipient,
      encrypted: encryptPii(normalized, this.encryptionKey, "messaging.consent"),
    }
  }

  /** A consent's address, decrypted only to tell İYS; null for a row kept without one. */
  iysAddressOf(row: { recipient_encrypted: string | null }): string | null {
    return row.recipient_encrypted
      ? decryptPii(row.recipient_encrypted, this.encryptionKey, "messaging.consent")
      : null
  }

  /**
   * What İYS made of a change. A row changed again meanwhile keeps waiting:
   * the newer answer is the one İYS must hear.
   */
  @InjectTransactionManager()
  async markIys(
    id: string,
    changedAt: Date,
    outcome: { status: "sent" | "failed"; error?: string | null },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listMessageConsents(
      { id },
      { take: 1, select: ["id", "changed_at"] },
      sharedContext
    )
    if (row && new Date(row.changed_at).getTime() === new Date(changedAt).getTime()) {
      await this.updateMessageConsents(
        {
          id,
          iys_status: outcome.status,
          iys_error: outcome.error ?? null,
          iys_sent_at: outcome.status === "sent" ? new Date() : null,
        },
        sharedContext
      )
    }
  }

  /** The recipient's answer with where and when it came; null when it never gave one. */
  @InjectManager()
  async consentRecordOf(
    channel: ConsentChannel,
    address: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ status: ConsentStatus; source: ConsentSource; changed_at: Date } | null> {
    const recipient = this.recipientOf(channel, address)
    if (!recipient) {
      return null
    }
    const [row] = await this.listMessageConsents(
      { channel, recipient_hash: recipient.hash },
      { take: 1, select: ["status", "source", "changed_at"] },
      sharedContext
    )
    return row ? { status: row.status, source: row.source, changed_at: row.changed_at } : null
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

  // Protected for the confirmation of a consent request, in its own transaction
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
    if (row && (input.only_new || row.status === input.status)) {
      return { id: row.id, changed: false }
    }
    const now = input.given_at ?? new Date()
    const values = {
      status: input.status,
      source: input.source,
      changed_at: now,
      changed_by: input.changed_by ?? null,
      // İYS hears of every change (F10) but one that came from İYS; a customer's own record moves with it
      iys_status: input.source === "iys" ? ("not_required" as const) : ("pending" as const),
      iys_error: null,
      recipient_encrypted: recipient.encrypted,
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
    // The generated writer itself is closed below: events are written only here
    await super.createMessageConsentEvents(
      {
        consent_id: consent.id,
        channel: input.channel,
        status: input.status,
        source: input.source,
        changed_at: now,
        changed_by: input.changed_by ?? null,
        evidence: input.evidence ?? null,
      },
      sharedContext
    )
    return { id: consent.id, changed: true }
  }

  /**
   * Withdraws a consent found by its keyed hash: an unsubscribe link names
   * the recipient so, never by address. No consent, nothing to withdraw.
   */
  @InjectTransactionManager()
  async revokeByHash(
    channel: ConsentChannel,
    recipientHash: string,
    source: ConsentSource,
    evidence: ConsentEvidence | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ changed: boolean }> {
    const [row] = await this.listMessageConsents(
      { channel, recipient_hash: recipientHash },
      { take: 1 },
      sharedContext
    )
    if (row?.status !== "granted") {
      return { changed: false }
    }
    const now = new Date()
    await this.updateMessageConsents(
      {
        id: row.id,
        status: "revoked",
        source,
        changed_at: now,
        changed_by: null,
        iys_status: "pending",
      },
      sharedContext
    )
    await super.createMessageConsentEvents(
      {
        consent_id: row.id,
        channel,
        status: "revoked",
        source,
        changed_at: now,
        changed_by: null,
        evidence,
      },
      sharedContext
    )
    return { changed: true }
  }

  // A consent's history is proof: written only by recordConsent and
  // revokeByHash, never changed or removed. Field initialisers run after
  // the base constructor, so these replace the generated methods.
  override createMessageConsentEvents = refuseWrite
  override updateMessageConsentEvents = refuseWrite
  override deleteMessageConsentEvents = refuseWrite
  override softDeleteMessageConsentEvents = refuseWrite
  override restoreMessageConsentEvents = refuseWrite
}
