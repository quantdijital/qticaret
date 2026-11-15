import { createHash, randomBytes } from "node:crypto"
import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { ConsentRecords } from "./consent-records"
import type { ConsentEvidence, ConsentStatus } from "./types"

/** A confirmation link opens for this long; after it, the consent is asked for again. */
const REQUEST_MS = 7 * 24 * 60 * 60 * 1000

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex")

export interface ConsentRequestInput {
  channel: MessageChannel
  address: string
  status: ConsentStatus
  source: "checkout" | "account" | "newsletter"
  customer_id?: string | null
  evidence?: ConsentEvidence | null
}

/**
 * Double opt-in (security review 2026-10-29): a consent for an address no
 * one has shown is theirs waits for its owner. `requestConsent` keeps the
 * request and returns the link's token, for the message only;
 * `confirmConsentRequest` records it, once, within the week.
 */
export class ConsentRequests extends ConsentRecords {
  @InjectTransactionManager()
  async requestConsent(
    input: ConsentRequestInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; token: string }> {
    const recipient = this.requireRecipient(input.channel, input.address)
    const token = randomBytes(32).toString("base64url")
    const request = await this.createConsentRequests(
      {
        channel: input.channel,
        recipient_hash: recipient.hash,
        recipient_encrypted: recipient.encrypted,
        status: input.status,
        source: input.source,
        customer_id: input.customer_id ?? null,
        evidence: input.evidence ?? null,
        token_hash: tokenHash(token),
        expires_at: new Date(Date.now() + REQUEST_MS),
      },
      sharedContext
    )
    return { id: request.id, token }
  }

  /**
   * Whether the same request is still on its way: asked after `since`,
   * for the same customer, address and answer, neither confirmed nor
   * expired. An account asking again within that time is sent nothing
   * more (security review of PR #73, L3).
   */
  @InjectManager()
  async consentRequestPending(
    input: Pick<ConsentRequestInput, "channel" | "address" | "status" | "customer_id">,
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const recipient = this.recipientOf(input.channel, input.address)
    if (!recipient) {
      return false
    }
    const [request] = await this.listConsentRequests(
      {
        channel: input.channel,
        recipient_hash: recipient.hash,
        status: input.status,
        customer_id: input.customer_id ?? null,
        confirmed_at: null,
        expires_at: { $gt: new Date() },
        created_at: { $gt: since },
      },
      { take: 1, select: ["id"] },
      sharedContext
    )
    return request !== undefined
  }

  /** Where a request's confirmation goes, decrypted to send it; null once it is answered. */
  @InjectManager()
  async consentRequestOf(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ channel: MessageChannel; address: string; status: ConsentStatus } | null> {
    const [request] = await this.listConsentRequests(
      { id, confirmed_at: null },
      { take: 1 },
      sharedContext
    )
    const address = request ? this.iysAddressOf(request) : null
    return request && address ? { channel: request.channel, address, status: request.status } : null
  }

  /**
   * Records the consent a link asked for, once: the request is claimed in
   * one statement, so a link opened twice records it once. Null for a
   * token unknown, used or past its week.
   */
  @InjectTransactionManager()
  async confirmConsentRequest(
    token: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ channel: MessageChannel; status: ConsentStatus } | null> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("messaging: a consent request is confirmed in a transaction")
    }
    const now = new Date()
    const [request] = await manager.execute<
      {
        channel: MessageChannel
        recipient_encrypted: string
        status: ConsentStatus
        source: "checkout" | "account" | "newsletter"
        customer_id: string | null
        evidence: ConsentEvidence | null
      }[]
    >(
      `UPDATE consent_request SET confirmed_at = ?, updated_at = ?
       WHERE token_hash = ? AND confirmed_at IS NULL AND expires_at > ? AND deleted_at IS NULL
       RETURNING channel, recipient_encrypted, status, source, customer_id, evidence`,
      [now, now, tokenHash(token), now]
    )
    const address = request ? this.iysAddressOf(request) : null
    if (!request || !address) {
      return null
    }
    await this.recordConsent_(
      {
        channel: request.channel,
        address,
        status: request.status,
        source: request.source,
        customer_id: request.customer_id,
        // The proof: asked for so, and confirmed from the address itself
        evidence: { ...(request.evidence ?? {}), confirmed_at: now.toISOString() },
      },
      sharedContext
    )
    return { channel: request.channel, status: request.status }
  }
}
