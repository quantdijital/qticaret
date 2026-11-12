import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { isSerializedEnvelope, parseEnvelope } from "@qticaret/server-kit"
import { createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { credentialKeyring } from "../../lib/integrations/credential-keys"
import type { CredentialKeyring } from "../../lib/integrations/credential-keys"
import { logger } from "../../lib/logging"
import { IntegrationCredential } from "./models/integration-credential"
import { versionSource } from "./rows"
import { openCredentials, upgradedSeal } from "./sealing"
import type { Sealed, SealedRow } from "./sealing"
import { keyStatusOf } from "./key-status"
import type { CredentialKeyStatus, KeyCount } from "./key-status"
import { logCredentialFailure } from "./safe-log"
import type {
  IntegrationCredentialRecord,
  IntegrationCredentialsModuleOptions,
  ResolvedCredentials,
} from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface RewrapTally {
  /** Envelopes whose data key moved to the current KEK. */
  rewrapped: number
  /** adr/0027 rows sealed again as envelopes. */
  upgraded: number
  /** Under a key this process does not hold: left as they are. */
  stranded: number
  /** Damaged or moved rows: left as they are. */
  failed: number
  /** The failed and stranded rows' providers, for the log (never a value). */
  failed_providers: string[]
}

const REWRAP_BATCH = 100

/**
 * The rows' side of the credentials service (adr/0061 Ek C17): the keyring,
 * opening a row and upgrading it as it is read, the cache of opened
 * accounts, the rewrap pass and the key status. Every write here is a
 * compare-and-swap on the sealed text, so it never undoes a save made in
 * between; `updated_at` is left alone: the account did not change.
 */
export class CredentialRows extends MedusaService({ IntegrationCredential }) {
  protected readonly cache: VersionedCache<Map<string, ResolvedCredentials>>
  // A holder, not a field set later: the module's proxy forwards reads to
  // the service but would keep an assignment for itself
  private readonly seen: { keyring?: CredentialKeyring | null } = {}

  constructor(
    container: Record<string, unknown>,
    options: IntegrationCredentialsModuleOptions = {}
  ) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.cache = createVersionedCache({
      name: "integration_credentials",
      source: versionSource(options),
      load: () => this.loadAll_(),
    })
  }

  /** The configured keys, null without any (lib/integrations/credential-keys.ts). */
  protected keyring(): CredentialKeyring | null {
    return credentialKeyring()
  }

  /**
   * Accounts opened under keys since changed are not served from the
   * cache: a key removed from the environment stops opening rows at once.
   * Keys change at a restart once deployed; a test changes them in place.
   */
  protected async followKeyring(): Promise<void> {
    const keyring = this.keyring()
    const seen = this.seen.keyring
    this.seen.keyring = keyring
    if (seen !== undefined && seen !== keyring) {
      await this.cache.invalidate()
    }
  }

  /**
   * The row's secrets, or null when no configured key opens them. A row
   * still in adr/0027's format is sealed again as an envelope; a failure
   * there is logged and the read goes on. An envelope under an older KEK is
   * left to the rewrap: while a rotation rolls out, processes that put a
   * different key first would otherwise move the same rows back and forth.
   */
  protected async openRow(
    row: Pick<IntegrationCredentialRecord, "id" | "provider" | "settings"> & Sealed
  ): Promise<Record<string, string> | null> {
    const keyring = this.keyring()
    if (!keyring) {
      return null
    }
    const opened = await openCredentials(keyring, row)
    if (!opened.ok) {
      logger.error({
        event: `integration_credentials.${opened.reason === "kek_missing" ? "kek_missing" : "unreadable"}`,
        provider: row.provider,
        key_id: row.key_id,
      })
      return null
    }
    if (opened.stale && !isSerializedEnvelope(row.secret_ciphertext)) {
      try {
        const sealed = await upgradedSeal(keyring, row, opened.secrets)
        if (await this.swapSealed_(row.id, row.secret_ciphertext, sealed)) {
          logger.info({
            event: "integration_credentials.upgraded",
            provider: row.provider,
            from: "legacy",
          })
        }
      } catch (error) {
        // By code alone: a database error's message holds both sealed texts
        logCredentialFailure("warn", "integration_credentials.upgrade_failed", error, {
          provider: row.provider,
        })
      }
    }
    return opened.secrets
  }

  @InjectManager()
  protected async loadAll_(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, ResolvedCredentials>> {
    const rows = await this.listIntegrationCredentials({}, {}, sharedContext)
    const resolved = new Map<string, ResolvedCredentials>()
    for (const row of rows) {
      const secrets = await this.openRow(row)
      if (secrets) {
        resolved.set(row.provider, { settings: row.settings, secrets })
      }
    }
    return resolved
  }

  /** Writes `to` only while the row still holds `from`. Whether it did. */
  @InjectManager()
  protected async swapSealed_(
    id: string,
    from: string,
    to: Sealed,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `UPDATE integration_credential SET secret_ciphertext = ?, key_id = ?
        WHERE id = ? AND secret_ciphertext = ? AND deleted_at IS NULL RETURNING id`,
      [to.secret_ciphertext, to.key_id, id, from]
    )) as unknown[]
    return rows.length > 0
  }

  /** One row moved to the current KEK; the data is decrypted only for an old-format row. */
  private async rewrapRow(
    keyring: CredentialKeyring,
    row: SealedRow & { id: string },
    tally: RewrapTally,
    legacyOnly: boolean
  ): Promise<void> {
    const envelope = isSerializedEnvelope(row.secret_ciphertext)
    if (envelope && (legacyOnly || row.key_id === keyring.wrapper.kekId)) {
      return
    }
    const opened = envelope
      ? await this.openForRewrap(keyring, row)
      : await openCredentials(keyring, row)
    if (!opened.ok) {
      tally[opened.reason === "kek_missing" ? "stranded" : "failed"] += 1
      tally.failed_providers.push(row.provider)
      return
    }
    try {
      const sealed = await upgradedSeal(keyring, row, opened.secrets)
      if (await this.swapSealed_(row.id, row.secret_ciphertext, sealed)) {
        tally[envelope ? "rewrapped" : "upgraded"] += 1
      }
    } catch {
      // Counted, never logged here: the error may carry the SQL and its values
      tally.failed += 1
      tally.failed_providers.push(row.provider)
    }
  }

  /** An envelope needs no data opened to be rewrapped: only its KEK is checked here. */
  private openForRewrap(keyring: CredentialKeyring, row: SealedRow) {
    try {
      const { kekId } = parseEnvelope(row.secret_ciphertext)
      if (kekId !== row.key_id) {
        return Promise.resolve({ ok: false, reason: "unreadable" } as const)
      }
      return Promise.resolve(
        keyring.wrapper.canUnwrap(kekId)
          ? ({ ok: true, secrets: {} } as const)
          : ({ ok: false, reason: "kek_missing" } as const)
      )
    } catch {
      return Promise.resolve({ ok: false, reason: "unreadable" } as const)
    }
  }

  /**
   * One rewrap pass (adr/0061 Ek C17): every row under an older configured
   * KEK, and every row still in adr/0027's format, sealed as new rows are,
   * `REWRAP_BATCH` at a time by id. `limit` stops after that many rows
   * moved (a partial run; the next one finishes). Idempotent: rows already
   * current are skipped, and a row saved meanwhile is not overwritten.
   *
   * `legacyOnly` (the hourly job, review L1): adr/0027 rows only, never a
   * KEK move. A process left on an older key order would otherwise wrap
   * rows back under a key the operator is about to remove; KEK moves come
   * only from `credentials:keys rewrap`, run from the updated config.
   */
  @InjectManager()
  async rewrapAll(
    options: { limit?: number; legacyOnly?: boolean } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RewrapTally> {
    const tally: RewrapTally = {
      rewrapped: 0,
      upgraded: 0,
      stranded: 0,
      failed: 0,
      failed_providers: [],
    }
    const keyring = this.keyring()
    if (!keyring) {
      return tally
    }
    const limit = options.limit ?? Number.POSITIVE_INFINITY
    let after = ""
    for (;;) {
      const rows = await this.listIntegrationCredentials(
        { id: { $gt: after } },
        {
          select: ["id", "provider", "settings", "secret_ciphertext", "key_id"],
          order: { id: "ASC" },
          take: REWRAP_BATCH,
        },
        sharedContext
      )
      for (const row of rows) {
        if (tally.rewrapped + tally.upgraded >= limit) {
          return tally
        }
        await this.rewrapRow(keyring, row, tally, options.legacyOnly === true)
      }
      if (rows.length < REWRAP_BATCH) {
        break
      }
      after = rows[rows.length - 1]?.id ?? after
    }
    if (tally.rewrapped + tally.upgraded > 0) {
      // The opened accounts are the same; the next read takes the rows as they are now
      await this.cache.invalidate()
    }
    return tally
  }

  /** Per key, how many rows it holds and in which format; counts and fingerprints only. */
  @InjectManager()
  async keyStatus(@MedusaContext() sharedContext: Context = {}): Promise<CredentialKeyStatus> {
    const counts = (await (sharedContext.manager as Executor).execute(
      // The same test as isSerializedEnvelope (review I2)
      `SELECT key_id, (secret_ciphertext ~ '^qtenv[0-9]+\\.') AS envelope, count(*)::int AS records
         FROM integration_credential WHERE deleted_at IS NULL GROUP BY 1, 2`,
      []
    )) as KeyCount[]
    return keyStatusOf(this.keyring(), counts)
  }
}
