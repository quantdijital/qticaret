import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { ConsentRequests } from "./consent-requests"
import type { SuppressionInput } from "./types"

/**
 * Who takes which messages (adr/0036): commercial consent per channel,
 * with its history (`ConsentRecords`) and the double opt-in of addresses
 * no one has shown are theirs (`ConsentRequests`), and the addresses
 * nothing goes to.
 * An address is stored only as a keyed hash and a masked form; plaintext
 * never reaches the database or an error.
 */
class MessagingModuleService extends ConsentRequests {
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
