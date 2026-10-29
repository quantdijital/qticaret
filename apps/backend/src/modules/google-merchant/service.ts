import { createHash, randomBytes } from "node:crypto"
import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, parseKey } from "../../lib/crypto/pii"
import { uniqueViolationKeys } from "../../lib/errors"
import { GoogleOauthState } from "./models/oauth-state"
import { MerchantOffer } from "./models/merchant-offer"
import { MerchantSync } from "./models/merchant-sync"

export interface GoogleMerchantOptions {
  encryptionKey: string
}

const STATE_MS = 10 * 60 * 1000
const CONTEXT = "google-merchant.verifier"

const hashOf = (value: string): string => createHash("sha256").update(value).digest("hex")

/** The shop's Google connection under way and what its Merchant Center holds (F10 M13). */
class GoogleMerchantModuleService extends MedusaService({
  GoogleOauthState,
  MerchantOffer,
  MerchantSync,
}) {
  private readonly encryptionKey: Buffer

  constructor(container: Record<string, unknown>, options: GoogleMerchantOptions) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.encryptionKey = parseKey(options.encryptionKey, "google-merchant encryptionKey")
  }

  /** A new `state` for the staff member, keeping the PKCE verifier on the server. */
  async startState(userId: string, verifier: string): Promise<string> {
    const state = randomBytes(24).toString("base64url")
    await this.createGoogleOauthStates({
      state_hash: hashOf(state),
      verifier_encrypted: encryptPii(verifier, this.encryptionKey, CONTEXT),
      user_id: userId,
      expires_at: new Date(Date.now() + STATE_MS),
    })
    return state
  }

  /**
   * The verifier of a `state`, once; null for one unknown, used or past its
   * ten minutes. Taken in one statement, so two callbacks at once cannot
   * both have it (security review 2026-10-29).
   */
  @InjectTransactionManager()
  async takeState(
    state: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ verifier: string; user_id: string } | null> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("google-merchant: a state is taken in a transaction")
    }
    const [row] = await manager.execute<
      { verifier_encrypted: string; user_id: string; expires_at: Date | string }[]
    >(
      `DELETE FROM google_oauth_state WHERE state_hash = ? AND deleted_at IS NULL
       RETURNING verifier_encrypted, user_id, expires_at`,
      [hashOf(state)]
    )
    if (!row) {
      return null
    }
    return new Date(row.expires_at) > new Date()
      ? {
          verifier: decryptPii(row.verifier_encrypted, this.encryptionKey, CONTEXT),
          user_id: row.user_id,
        }
      : null
  }

  /** What Merchant Center holds from us: each offer id with the hash of what was sent. */
  @InjectManager()
  async sentOffers(@MedusaContext() sharedContext: Context = {}): Promise<Map<string, string>> {
    const rows = await this.listMerchantOffers(
      {},
      { select: ["offer_id", "input_hash"] },
      sharedContext
    )
    return new Map(rows.map((row) => [row.offer_id, row.input_hash]))
  }

  /**
   * Records an offer sent, or sent again with new values. Two runs at once
   * (the schedule and the panel's button) both find no row: the second
   * insert meets the first and is done again as an update.
   */
  async recordOffer(offerId: string, inputHash: string): Promise<void> {
    try {
      await this.recordOffer_(offerId, inputHash)
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("offer_id")) {
        throw error
      }
      await this.recordOffer_(offerId, inputHash)
    }
  }

  @InjectTransactionManager()
  protected async recordOffer_(
    offerId: string,
    inputHash: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listMerchantOffers({ offer_id: offerId }, { take: 1 }, sharedContext)
    if (row) {
      await this.updateMerchantOffers({ id: row.id, input_hash: inputHash }, sharedContext)
    } else {
      await this.createMerchantOffers({ offer_id: offerId, input_hash: inputHash }, sharedContext)
    }
  }

  /** Keeps the last run's numbers, for the panel; one row. */
  @InjectTransactionManager()
  async recordSync(
    result: { sent: number; removed: number; failed: number; error: string | null },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const old = await this.listMerchantSyncs({}, { select: ["id"] }, sharedContext)
    if (old.length > 0) {
      await this.deleteMerchantSyncs(
        old.map(({ id }) => id),
        sharedContext
      )
    }
    await this.createMerchantSyncs(
      { sent: result.sent, removed: result.removed, failed: result.failed, error: result.error },
      sharedContext
    )
  }

  /** Forgets offers removed from Merchant Center, or all of them when the shop disconnects. */
  @InjectTransactionManager()
  async forgetOffers(
    offerIds: string[] | "all",
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const rows = await this.listMerchantOffers(
      offerIds === "all" ? {} : { offer_id: offerIds },
      { select: ["id"] },
      sharedContext
    )
    if (rows.length > 0) {
      await this.deleteMerchantOffers(
        rows.map(({ id }) => id),
        sharedContext
      )
    }
  }
}

export default GoogleMerchantModuleService
