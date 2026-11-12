import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { isSerializedEnvelope, parseEnvelope } from "@qticaret/server-kit"
import type { CredentialKeyring } from "../../lib/integrations/credential-keys"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { CREDENTIAL_PROVIDER_NAMES } from "./providers"
import type { CredentialProviderName } from "./providers"
import { stampOf, storedOf } from "./rows"
import { planSave, statusOf } from "./rules"
import type { SaveInput } from "./rules"
import { openSealedDraft, resealedForRestore, sealCredentials } from "./sealing"
import type { Sealed } from "./sealing"
import { CredentialRows } from "./service-rows"
import type {
  CredentialDraft,
  CredentialStatus,
  ResolvedCredentials,
  StoredCredential,
  Verification,
} from "./types"

export type * from "./types"
export type { RewrapTally } from "./service-rows"
export type { CredentialKeyStatus } from "./key-status"

/**
 * The shop's provider accounts (adr/0027; envelopes since adr/0061 Ek C17).
 * Secrets go in sealed and come out only through `read` (the provider's
 * calls), `readForCheck` and `openDraft` (the check before a save);
 * nothing else returns them in any form.
 */
class IntegrationCredentialsModuleService extends CredentialRows {
  /** Whether the server has a key; without one the panel cannot save an account. */
  isKeyConfigured(): boolean {
    return this.keyring() !== null
  }

  /**
   * Refuses a save without a key: the owner is told (the panel's alert),
   * and the operator, whose setting it is, by an error log to alert on.
   */
  private keyMissing(provider: CredentialProviderName): ValidationError {
    logger.error({ event: "integration_credentials.key_missing", provider })
    return new ValidationError("integration_credentials.key_missing")
  }

  private requireKeyring(provider: CredentialProviderName): CredentialKeyring {
    const keyring = this.keyring()
    if (!keyring) {
      throw this.keyMissing(provider)
    }
    return keyring
  }

  /** The account for a provider's call (cached); null when none is usable. */
  async read(provider: CredentialProviderName): Promise<ResolvedCredentials | null> {
    await this.followKeyring()
    return (await this.cache.get()).get(provider) ?? null
  }

  /** Every provider the shop can connect, as stored now (not the cache). */
  @InjectManager()
  async describeAll(@MedusaContext() sharedContext: Context = {}): Promise<CredentialStatus[]> {
    const rows = await this.listIntegrationCredentials({}, {}, sharedContext)
    const statuses: CredentialStatus[] = []
    for (const provider of CREDENTIAL_PROVIDER_NAMES) {
      const row = rows.find((candidate) => candidate.provider === provider)
      statuses.push(statusOf(provider, row, row ? await this.openRow(row) : null))
    }
    return statuses
  }

  @InjectManager()
  async describe(
    provider: CredentialProviderName,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CredentialStatus> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 }, sharedContext)
    return statusOf(provider, row, row ? await this.openRow(row) : null)
  }

  /**
   * Checks what the panel sent and seals it with the stored secrets the
   * shop left blank (`planSave`). The draft carries ciphertext only.
   */
  @InjectManager()
  async draft(
    provider: CredentialProviderName,
    input: SaveInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CredentialDraft> {
    const keyring = this.requireKeyring(provider)
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 }, sharedContext)
    const current = row ? await this.openRow(row) : null
    const plan = planSave(provider, input, row, current)
    const sealed = await sealCredentials(keyring, provider, plan.settings, plan.secrets)
    return {
      provider,
      settings: plan.settings,
      secret_ciphertext: sealed.secret_ciphertext,
      needs_check: plan.needsCheck,
      secrets_changed: plan.secretsChanged,
      connected: row?.verification === "verified" && current !== null,
    }
  }

  /** A draft's account in the clear, for the check against the provider; nothing keeps it. */
  async openDraft(draft: CredentialDraft): Promise<ResolvedCredentials> {
    const keyring = this.requireKeyring(draft.provider)
    const secrets = await openSealedDraft(
      keyring,
      draft.provider,
      draft.settings,
      draft.secret_ciphertext
    )
    if (!secrets) {
      throw this.keyMissing(draft.provider)
    }
    return { settings: draft.settings, secrets }
  }

  /**
   * The draft's columns: its envelope and the KEK it names; a draft sealed
   * the old way (made before the upgrade, still in a workflow) is sealed
   * again as new rows are.
   */
  private async sealedOf(draft: CredentialDraft): Promise<Sealed> {
    if (isSerializedEnvelope(draft.secret_ciphertext)) {
      const { kekId } = parseEnvelope(draft.secret_ciphertext)
      return { secret_ciphertext: draft.secret_ciphertext, key_id: kekId }
    }
    const keyring = this.requireKeyring(draft.provider)
    const { secrets } = await this.openDraft(draft)
    return sealCredentials(keyring, draft.provider, draft.settings, secrets)
  }

  /**
   * Saves a draft. `verification` null keeps the stored result (only a
   * setting such as test mode changed). Returns the row before, for a
   * compensation.
   */
  async store(
    draft: CredentialDraft,
    verification: Verification | null,
    actorId: string | null
  ): Promise<StoredCredential | null> {
    const sealed = await this.sealedOf(draft)
    let previous: StoredCredential | null
    try {
      previous = await this.storeInTransaction_(draft, sealed, verification, actorId)
    } catch (error) {
      // A first save racing another inserts the provider twice; the second retries
      if (!uniqueViolationKeys(error)?.includes("provider")) {
        throw error
      }
      previous = await this.storeInTransaction_(draft, sealed, verification, actorId)
    }
    await this.cache.invalidate()
    return previous
  }

  @InjectTransactionManager()
  protected async storeInTransaction_(
    draft: CredentialDraft,
    sealed: Sealed,
    verification: Verification | null,
    actorId: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoredCredential | null> {
    const [row] = await this.listIntegrationCredentials(
      { provider: draft.provider },
      { take: 1 },
      sharedContext
    )
    const checked = verification ?? row?.verification ?? "unverified"
    const values = {
      settings: draft.settings,
      secret_ciphertext: sealed.secret_ciphertext,
      key_id: sealed.key_id,
      verification: checked,
      verified_at:
        verification === "verified" ? new Date() : verification ? null : (row?.verified_at ?? null),
      updated_by: actorId,
    }
    if (row) {
      await this.updateIntegrationCredentials(
        {
          id: row.id,
          ...values,
          secrets_version: row.secrets_version + (draft.secrets_changed ? 1 : 0),
        },
        sharedContext
      )
      return storedOf(row)
    }
    await this.createIntegrationCredentials(
      { provider: draft.provider, ...values, secrets_version: 1 },
      sharedContext
    )
    return null
  }

  /**
   * The stored account as it is now (not the cache) for "test the
   * connection", with a stamp of the row: `recordCheck` keeps the result
   * only while the row is still the one checked.
   */
  async readForCheck(
    provider: CredentialProviderName
  ): Promise<{ account: ResolvedCredentials; stamp: string } | null> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 })
    const secrets = row ? await this.openRow(row) : null
    return row && secrets
      ? { account: { settings: row.settings, secrets }, stamp: stampOf(row) }
      : null
  }

  /** Keeps a check's result; false when the account changed while it ran. */
  async recordCheck(
    provider: CredentialProviderName,
    verification: Verification,
    stamp: string
  ): Promise<boolean> {
    const recorded = await this.recordCheck_(provider, verification, stamp)
    // After the commit: a reader in between would otherwise cache the old state again
    if (recorded) {
      await this.cache.invalidate()
    }
    return recorded
  }

  /** The row stays locked from the comparison to the write: a save in between waits, then wins. */
  @InjectTransactionManager()
  protected async recordCheck_(
    provider: CredentialProviderName,
    verification: Verification,
    stamp: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("integration_credentials: a check is recorded in a transaction")
    }
    await manager.execute(
      "SELECT id FROM integration_credential WHERE provider = ? AND deleted_at IS NULL FOR UPDATE",
      [provider]
    )
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 }, sharedContext)
    if (!row || stampOf(row) !== stamp) {
      return false
    }
    await this.updateIntegrationCredentials(
      {
        id: row.id,
        verification,
        verified_at: verification === "verified" ? new Date() : null,
      },
      sharedContext
    )
    return true
  }

  /** Deletes the account outright; returns it for a compensation. */
  async remove(provider: CredentialProviderName): Promise<StoredCredential | null> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 })
    if (!row) {
      return null
    }
    await this.deleteIntegrationCredentials(row.id)
    await this.cache.invalidate()
    return storedOf(row)
  }

  /**
   * Puts the account back as it was before a save or a removal (workflow
   * compensation), sealed under the current KEK (review I4).
   */
  async restore(provider: CredentialProviderName, stored: StoredCredential | null): Promise<void> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 })
    const previous = stored && {
      ...stored,
      ...(await resealedForRestore(this.keyring(), { provider, ...stored })),
    }
    if (previous === null) {
      if (row) {
        await this.deleteIntegrationCredentials(row.id)
      }
    } else if (row) {
      await this.updateIntegrationCredentials({ id: row.id, ...previous })
    } else {
      await this.createIntegrationCredentials({ provider, ...previous })
    }
    await this.cache.invalidate()
  }
}

export default IntegrationCredentialsModuleService
