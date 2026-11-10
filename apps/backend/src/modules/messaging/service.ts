import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { ConsentRequests } from "./consent-requests"
import type { SkipInput, SuppressionInput, TemplateTextRow, TemplateTextValues } from "./types"

const TEMPLATE_TEXT_FIELDS = [
  "template",
  "enabled",
  "subject",
  "preheader",
  "heading",
  "intro",
  "sms",
  "updated_by",
] as const

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

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

  /** Notes a send that did not go out; the same send noted again keeps its latest reason. */
  async noteSkip(input: SkipInput): Promise<void> {
    try {
      await this.noteSkip_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("send_key")) {
        throw error
      }
      await this.noteSkip_(input)
    }
  }

  @InjectTransactionManager()
  protected async noteSkip_(
    input: SkipInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listMessageSkips(
      { send_key: input.send_key },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (row) {
      await this.updateMessageSkips(
        { id: row.id, reason: input.reason, recipient_masked: input.recipient_masked },
        sharedContext
      )
      return
    }
    await this.createMessageSkips(input, sharedContext)
  }

  /** The send went out after all: what was noted against it goes. */
  @InjectTransactionManager()
  async clearSkip(sendKey: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(`DELETE FROM message_skip WHERE send_key = ?`, [sendKey])
  }

  /** The customer messages the shop reworded or turned off (adr/0036 Ek 2026-11-10). */
  @InjectManager()
  async templateTexts(@MedusaContext() sharedContext: Context = {}): Promise<TemplateTextRow[]> {
    const rows = await this.listMessageTemplateTexts(
      {},
      { select: [...TEMPLATE_TEXT_FIELDS], take: null },
      sharedContext
    )
    return rows
  }

  /** One template's words and switch, or null for the platform's own. */
  @InjectManager()
  async templateTextOf(
    template: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TemplateTextRow | null> {
    const [row] = await this.listMessageTemplateTexts(
      { template },
      { take: 1, select: [...TEMPLATE_TEXT_FIELDS] },
      sharedContext
    )
    return (row as TemplateTextRow | undefined) ?? null
  }

  /** Saves a template's words and switch, all fields at once; two saves at once keep the last. */
  async saveTemplateText(template: string, values: TemplateTextValues, by: string | null) {
    try {
      await this.saveTemplateText_(template, values, by)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("template")) {
        throw error
      }
      await this.saveTemplateText_(template, values, by)
    }
  }

  @InjectTransactionManager()
  protected async saveTemplateText_(
    template: string,
    values: TemplateTextValues,
    by: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listMessageTemplateTexts(
      { template },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (row) {
      await this.updateMessageTemplateTexts(
        { id: row.id, ...values, updated_by: by },
        sharedContext
      )
      return
    }
    await this.createMessageTemplateTexts({ template, ...values, updated_by: by }, sharedContext)
  }

  /** Skips last noted before `before` go; returns how many. */
  @InjectTransactionManager()
  async pruneSkips(before: Date, @MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `DELETE FROM message_skip WHERE updated_at < ? RETURNING id`,
      [before]
    )) as unknown[]
    return rows.length
  }
}

export default MessagingModuleService
