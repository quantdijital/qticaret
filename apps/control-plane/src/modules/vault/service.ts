import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import { generateEd25519KeyPair } from "@qticaret/server-kit"
import { PLATFORM_OWNER } from "../../lib/vault/secret-names"
import type { SigningKeyStatus } from "./models/signing-key"
import { VaultRecords, lockName } from "./service-records"
import type { Executor } from "./service-records"

export interface SigningKeyView {
  id: string
  kid: string
  public_key: string
  status: SigningKeyStatus
  secret_name: string
  activated_at: Date | null
  retired_at: Date | null
  created_at: Date
}

const KEY_FIELDS = [
  "id",
  "kid",
  "public_key",
  "status",
  "secret_name",
  "activated_at",
  "retired_at",
  "created_at",
] as const

const conflict = (key: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, key)
const LOCK = "cp_signing_key"

/**
 * The vault (adr/0061 §2 `secrets`, §4, Ek C8): sealed secrets, escrow
 * copies (service-records.ts) and the control plane's signing keys. A
 * signing key's rotation is three steps, each its own call (§4.5): a
 * `next` key is made and published; signing switches to it (the old one
 * stays published as `previous`); the old one is retired and its private
 * half destroyed. The private half is made here and sealed straight into
 * the vault: it never leaves this class.
 */
class VaultModuleService extends VaultRecords {
  @InjectManager()
  async signingKeys(@MedusaContext() sharedContext: Context = {}): Promise<SigningKeyView[]> {
    const rows = await this.listCpSigningKeys(
      {},
      { select: [...KEY_FIELDS], order: { created_at: "ASC" }, take: 200 },
      sharedContext
    )
    return rows
  }

  @InjectManager()
  async signingKeyIn(
    status: SigningKeyStatus,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SigningKeyView | null> {
    const [row] = await this.listCpSigningKeys(
      { status },
      { select: [...KEY_FIELDS], take: 1 },
      sharedContext
    )
    return (row as unknown as SigningKeyView | undefined) ?? null
  }

  /**
   * A new key pair: `active` when there is none yet, otherwise `next`
   * (refused while a `next` waits). Its seed sealed as a platform secret.
   */
  @InjectTransactionManager()
  async prepareSigningKey(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; kid: string; status: SigningKeyStatus }> {
    await lockName(sharedContext, LOCK)
    if (await this.signingKeyIn("next", sharedContext)) {
      throw conflict("cp.signing_next_exists")
    }
    const status = (await this.signingKeyIn("active", sharedContext)) ? "next" : "active"
    const pair = generateEd25519KeyPair()
    const secretName = `cp_signing_key.${pair.kid}`
    await this.putSecret(
      { owner: PLATFORM_OWNER, name: secretName, value: pair.seed },
      sharedContext
    )
    const [created] = await this.createCpSigningKeys(
      [
        {
          kid: pair.kid,
          public_key: pair.publicKey,
          status,
          secret_name: secretName,
          activated_at: status === "active" ? new Date() : null,
        },
      ],
      sharedContext
    )
    return { id: (created as { id: string }).id, kid: pair.kid, status }
  }

  /** The undo of `prepareSigningKey`: the key and its sealed seed gone, if still unused. */
  @InjectTransactionManager()
  async discardSigningKey(id: string, @MedusaContext() sharedContext: Context = {}) {
    const [row] = await this.listCpSigningKeys(
      { id },
      { select: ["id", "status", "secret_name"], take: 1 },
      sharedContext
    )
    if (row?.status === "next") {
      await this.deleteCpSigningKeys([id], sharedContext)
      await this.destroySecret(PLATFORM_OWNER, row.secret_name, sharedContext)
    }
  }

  /**
   * Signing moves to the `next` key; the `active` one becomes `previous`
   * and stays published. Refused without a `next`, or while a `previous`
   * still waits to be retired (one overlap at a time).
   */
  @InjectTransactionManager()
  async switchSigningKey(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: string | null; to: string }> {
    await lockName(sharedContext, LOCK)
    const next = await this.signingKeyIn("next", sharedContext)
    if (!next) {
      throw conflict("cp.signing_no_next")
    }
    if (await this.signingKeyIn("previous", sharedContext)) {
      throw conflict("cp.signing_previous_pending")
    }
    const active = await this.signingKeyIn("active", sharedContext)
    const manager = sharedContext.transactionManager as Executor
    // In this order: one `active` at a time is a unique index
    await manager.execute(
      `UPDATE cp_signing_key SET status = 'previous', updated_at = now()
        WHERE status = 'active' AND deleted_at IS NULL`,
      []
    )
    await manager.execute(
      `UPDATE cp_signing_key SET status = 'active', activated_at = now(), updated_at = now()
        WHERE id = ?`,
      [next.id]
    )
    return { from: active?.kid ?? null, to: next.kid }
  }

  /** The `previous` key leaves the published set; its private half is destroyed. */
  @InjectTransactionManager()
  async retirePreviousSigningKey(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ kid: string }> {
    await lockName(sharedContext, LOCK)
    const previous = await this.signingKeyIn("previous", sharedContext)
    if (!previous) {
      throw conflict("cp.signing_no_previous")
    }
    await (sharedContext.transactionManager as Executor).execute(
      `UPDATE cp_signing_key SET status = 'retired', retired_at = now(), updated_at = now()
        WHERE id = ?`,
      [previous.id]
    )
    await this.destroySecret(PLATFORM_OWNER, previous.secret_name, sharedContext)
    return { kid: previous.kid }
  }
}

export default VaultModuleService
