import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { openEnvelope, parseEnvelope, sealEnvelope, serializeEnvelope } from "@qticaret/server-kit"
import { masterKeyWrapper } from "../../lib/vault/keks"
import { emptyTally, olderKekIds, rewrapRows } from "../../lib/vault/rewrap"
import type { RewrapTally } from "../../lib/vault/rewrap"
import { assertSecretAddress, secretContext } from "../../lib/vault/secret-names"
import { retire } from "./retire"
import { SecretEscrow } from "./models/secret-escrow"
import { SecretRecord } from "./models/secret-record"
import { CpSigningKey } from "./models/signing-key"

export interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** What may be shown of a secret: never its value, never its sealed form. */
export interface SecretMeta {
  id: string
  owner: string
  name: string
  version: number
  kek_id: string
  created_at: Date
}

export interface EscrowMeta {
  id: string
  tenant_id: string
  version: number
  recipients: string[]
  created_at: Date
}

type EscrowRow = Omit<EscrowMeta, "recipients"> & { recipients: string }

const escrowMeta = (row: EscrowRow): EscrowMeta => ({
  id: row.id,
  tenant_id: row.tenant_id,
  version: row.version,
  recipients: row.recipients.split(","),
  created_at: row.created_at,
})

const META = ["id", "owner", "name", "version", "kek_id", "created_at"] as const
const REWRAP_BATCH = 100

export const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)

/** Serialises writers of one name (a new version, a new escrow) inside the transaction. */
export async function lockName(sharedContext: Context, name: string): Promise<void> {
  await (sharedContext.transactionManager as Executor).execute(
    "SELECT pg_advisory_xact_lock(hashtext(?))",
    [name]
  )
}

/**
 * The vault's records (adr/0061 §2 `secrets`, Ek C8): sealed secrets and
 * escrow copies. Values are sealed and opened here, in memory, under the
 * control plane's KEK (lib/vault/keks.ts); nothing that leaves this class
 * carries one except `openSecret`'s answer to its caller.
 */
export class VaultRecords extends MedusaService({ SecretRecord, SecretEscrow, CpSigningKey }) {
  /**
   * A new version of `owner`/`name`, sealed; its metadata back. With
   * `retireOlder`, every older version is retired in the same transaction
   * (`retireSecret`): only the new one can be opened.
   */
  @InjectTransactionManager()
  async putSecret(
    input: { owner: string; name: string; value: string | Buffer; retireOlder?: boolean },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SecretMeta> {
    const { owner, name } = input
    assertSecretAddress(owner, name)
    await lockName(sharedContext, `secret_record:${owner}:${name}`)
    // Soft-deleted rows count too: a version number is never reused
    const [last] = (await (sharedContext.transactionManager as Executor).execute(
      "SELECT coalesce(max(version), 0)::int AS version FROM secret_record WHERE owner = ? AND name = ?",
      [owner, name]
    )) as { version: number }[]
    const version = (last?.version ?? 0) + 1
    const envelope = await sealEnvelope(
      input.value,
      secretContext(owner, name, version),
      masterKeyWrapper()
    )
    const [created] = await this.createSecretRecords(
      [{ owner, name, version, kek_id: envelope.kekId, sealed: serializeEnvelope(envelope) }],
      sharedContext
    )
    if (input.retireOlder === true) {
      await retire(sharedContext, owner, name, version)
    }
    return this.secretMeta(created as unknown as SecretMeta)
  }

  /**
   * The value of `owner`/`name` (the latest version, or `version`), opened
   * in memory. The caller keeps it out of logs, answers and workflow data,
   * and zeroes the buffer when done.
   */
  @InjectManager()
  async openSecret(
    owner: string,
    name: string,
    version?: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Buffer> {
    assertSecretAddress(owner, name)
    const [row] = await this.listSecretRecords(
      { owner, name, ...(version === undefined ? {} : { version }) },
      { select: ["id", "version", "sealed"], order: { version: "DESC" }, take: 1 },
      sharedContext
    )
    if (!row) {
      throw notFound("cp.secret_unknown")
    }
    return openEnvelope(
      parseEnvelope(row.sealed),
      secretContext(owner, name, row.version),
      masterKeyWrapper()
    )
  }

  /** Every version's metadata, newest first; `owner` narrows it. Never a value. */
  @InjectManager()
  async listSecretMeta(
    owner?: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SecretMeta[]> {
    const rows = await this.listSecretRecords(
      owner === undefined ? {} : { owner },
      { select: [...META], order: { owner: "ASC", name: "ASC", version: "DESC" }, take: 1000 },
      sharedContext
    )
    return rows.map((row) => this.secretMeta(row as unknown as SecretMeta))
  }

  /** How many sealed secrets each KEK holds. */
  @InjectManager()
  async secretCountsByKek(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, number>> {
    const rows = (await (sharedContext.manager as Executor).execute(
      "SELECT kek_id, count(*)::int AS n FROM secret_record WHERE deleted_at IS NULL GROUP BY kek_id",
      []
    )) as { kek_id: string; n: number }[]
    return new Map(rows.map((row) => [row.kek_id, row.n]))
  }

  /**
   * One pass of the KEK rotation over the secrets (lib/vault/rewrap.ts):
   * the rows under an older configured KEK, `REWRAP_BATCH` at a time.
   */
  @InjectManager()
  async rewrapSecrets(@MedusaContext() sharedContext: Context = {}): Promise<RewrapTally> {
    const older = olderKekIds()
    const tally = emptyTally()
    let after = ""
    while (older.length > 0) {
      const rows = await this.listSecretRecords(
        { kek_id: older, id: { $gt: after } },
        {
          select: ["id", "owner", "name", "version", "sealed"],
          order: { id: "ASC" },
          take: REWRAP_BATCH,
        },
        sharedContext
      )
      await rewrapRows(
        rows.map((row) => ({
          id: row.id,
          sealed: row.sealed,
          context: secretContext(row.owner, row.name, row.version),
        })),
        (id, from, to, kekId) => this.swapSealed(id, from, to, kekId),
        tally
      )
      if (rows.length < REWRAP_BATCH) {
        break
      }
      after = rows[rows.length - 1]?.id ?? after
    }
    return tally
  }

  /** Writes `to` only while the row still holds `from`. Whether it did. */
  @InjectTransactionManager()
  protected async swapSealed(
    id: string,
    from: string,
    to: string,
    kekId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const rows = (await (sharedContext.transactionManager as Executor).execute(
      `UPDATE secret_record SET sealed = ?, kek_id = ?, updated_at = now()
        WHERE id = ? AND sealed = ? AND deleted_at IS NULL RETURNING id`,
      [to, kekId, id, from]
    )) as unknown[]
    return rows.length > 0
  }

  /** Every version of `owner`/`name` destroyed (a retired signing key). */
  @InjectTransactionManager()
  async destroySecret(
    owner: string,
    name: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    assertSecretAddress(owner, name)
    await (sharedContext.transactionManager as Executor).execute(
      "DELETE FROM secret_record WHERE owner = ? AND name = ?",
      [owner, name]
    )
  }

  /**
   * Every version of `owner`/`name` retired: its sealed form emptied and
   * the row soft-deleted, its number kept so a later version never reuses
   * it (an AI provider's key, adr/0085). Whether one was held.
   */
  @InjectTransactionManager()
  async retireSecret(
    owner: string,
    name: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    assertSecretAddress(owner, name)
    await lockName(sharedContext, `secret_record:${owner}:${name}`)
    return (await retire(sharedContext, owner, name)) > 0
  }

  /** A shop's escrow copy, its next version. */
  @InjectTransactionManager()
  async recordEscrow(
    input: { tenant_id: string; sealed: string; recipients: string[] },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<EscrowMeta> {
    if (!input.sealed.startsWith("-----BEGIN AGE ENCRYPTED FILE-----")) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.escrow_not_sealed")
    }
    await lockName(sharedContext, `secret_escrow:${input.tenant_id}`)
    const [last] = (await (sharedContext.transactionManager as Executor).execute(
      "SELECT coalesce(max(version), 0)::int AS version FROM secret_escrow WHERE tenant_id = ?",
      [input.tenant_id]
    )) as { version: number }[]
    const [created] = await this.createSecretEscrows(
      [
        {
          tenant_id: input.tenant_id,
          sealed: input.sealed,
          recipients: input.recipients.join(","),
          version: (last?.version ?? 0) + 1,
        },
      ],
      sharedContext
    )
    return escrowMeta(created as unknown as EscrowRow)
  }

  /** The undo of `recordEscrow` in a failed issue. */
  @InjectTransactionManager()
  async removeEscrow(id: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    await this.deleteSecretEscrows([id], sharedContext)
  }

  /** A shop's escrow copies, newest first, without their sealed bodies. */
  @InjectManager()
  async escrowsOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<EscrowMeta[]> {
    const rows = await this.listSecretEscrows(
      { tenant_id: tenantId },
      {
        select: ["id", "tenant_id", "version", "recipients", "created_at"],
        order: { version: "DESC" },
        take: 100,
      },
      sharedContext
    )
    return (rows as unknown as EscrowRow[]).map(escrowMeta)
  }

  private secretMeta(row: SecretMeta): SecretMeta {
    return {
      id: row.id,
      owner: row.owner,
      name: row.name,
      version: row.version,
      kek_id: row.kek_id,
      created_at: row.created_at,
    }
  }
}
