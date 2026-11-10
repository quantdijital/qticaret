import { randomBytes } from "node:crypto"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, hashPii, parseKey, safeEqual } from "@qticaret/server-kit"
import { uniqueViolationKeys } from "../../lib/errors"
import { FeedAccess } from "./models/feed-access"
import { FeedFile } from "./models/feed-file"

export interface MarketingFeedsOptions {
  hashKey: string
  encryptionKey: string
}

const CONTEXT = "marketing-feeds.token"

/** The feeds' token and their latest files (F10.8, adr/0038 §3). */
class MarketingFeedsModuleService extends MedusaService({ FeedAccess, FeedFile }) {
  private readonly hashKey: Buffer
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: MarketingFeedsOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.hashKey = parseKey(options.hashKey, "marketing-feeds hashKey")
    this.encryptionKey = parseKey(options.encryptionKey, "marketing-feeds encryptionKey")
  }

  private hashOf(token: string): string {
    return hashPii(token, this.hashKey, CONTEXT)
  }

  /** A new token for the feed addresses; the old one opens nothing from now on. */
  @InjectTransactionManager()
  async issueToken(@MedusaContext() sharedContext: Context = {}): Promise<string> {
    const token = randomBytes(24).toString("base64url")
    const old = await this.listFeedAccesses({}, { select: ["id"] }, sharedContext)
    if (old.length > 0) {
      await this.deleteFeedAccesses(
        old.map(({ id }) => id),
        sharedContext
      )
    }
    await this.createFeedAccesses(
      {
        token_hash: this.hashOf(token),
        token_encrypted: encryptPii(token, this.encryptionKey, CONTEXT),
      },
      sharedContext
    )
    return token
  }

  /** The current token, to show the addresses again; null while feeds are off. */
  @InjectManager()
  async currentToken(@MedusaContext() sharedContext: Context = {}): Promise<string | null> {
    const [access] = await this.listFeedAccesses(
      {},
      { take: 1, select: ["token_encrypted"] },
      sharedContext
    )
    return access ? decryptPii(access.token_encrypted, this.encryptionKey, CONTEXT) : null
  }

  /** Whether the token opens the feeds; compared in constant time. */
  @InjectManager()
  async opens(token: string, @MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    const [access] = await this.listFeedAccesses(
      {},
      { take: 1, select: ["token_hash"] },
      sharedContext
    )
    return access !== undefined && safeEqual(this.hashOf(token), access.token_hash)
  }

  /**
   * Records a target's new file; returns the key of the one it replaced, to
   * remove. Two builds at once (the schedule and the panel's button) both
   * find no row: the second insert meets the first and is done again as an
   * update.
   */
  async recordFile(input: {
    target: string
    file_key: string
    item_count: number
  }): Promise<string | null> {
    try {
      return await this.recordFile_(input)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("target")) {
        throw error
      }
      return this.recordFile_(input)
    }
  }

  @InjectTransactionManager()
  protected async recordFile_(
    input: { target: string; file_key: string; item_count: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [old] = await this.listFeedFiles({ target: input.target }, { take: 1 }, sharedContext)
    const values = { ...input, generated_at: new Date() }
    if (old) {
      await this.updateFeedFiles({ id: old.id, ...values }, sharedContext)
      return old.file_key
    }
    await this.createFeedFiles(values, sharedContext)
    return null
  }
}

export default MarketingFeedsModuleService
