import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { parseKey } from "../../lib/crypto/pii"
import { keyFingerprint, openSecret, sealSecret } from "../../lib/crypto/secrets"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { createRedisClient } from "../../lib/redis"
import type Redis from "ioredis"
import { IntegrationCredential } from "./models/integration-credential"
import { CREDENTIAL_PROVIDER_NAMES } from "./providers"
import type { CredentialProviderName } from "./providers"
import { planSave, statusOf } from "./rules"
import type { SaveInput } from "./rules"
import type {
  CredentialDraft,
  CredentialStatus,
  IntegrationCredentialRecord,
  IntegrationCredentialsModuleOptions,
  ResolvedCredentials,
  StoredCredential,
  Verification,
} from "./types"

export type * from "./types"

// Associated data: a blob copied onto another provider's row does not open
const contextOf = (provider: string) => `integration_credentials:${provider}`

const storedOf = (row: IntegrationCredentialRecord): StoredCredential => ({
  settings: row.settings,
  secret_ciphertext: row.secret_ciphertext,
  key_id: row.key_id,
  secrets_version: row.secrets_version,
  verification: row.verification,
  verified_at: row.verified_at,
  updated_by: row.updated_by,
})

/**
 * The shop's provider accounts (adr/0027). Secrets go in sealed and come
 * out only through `read` (the provider's calls) and `openDraft` (the
 * check before a save); nothing else returns them in any form.
 */
class IntegrationCredentialsModuleService extends MedusaService({ IntegrationCredential }) {
  private readonly key: Buffer | null
  private readonly keyId: string | null
  private readonly cache: VersionedCache<Map<string, ResolvedCredentials>>

  constructor(
    container: Record<string, unknown>,
    options: IntegrationCredentialsModuleOptions = {}
  ) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.key = options.encryptionKey
      ? parseKey(options.encryptionKey, "integrationCredentials encryptionKey")
      : null
    this.keyId = this.key ? keyFingerprint(this.key) : null
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "integration_credentials")),
          options.versionKey ?? "qt:credentials:version"
        )
      : null
    this.cache = createVersionedCache({
      name: "integration_credentials",
      source,
      load: () => this.loadAll_(),
    })
  }

  /** Whether the server has its key; without it the panel cannot save an account. */
  keyConfigured(): boolean {
    return this.key !== null
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ValidationError("integration_credentials.key_missing")
    }
    return this.key
  }

  /** The row's secrets, or null when they were sealed under another key or are damaged. */
  private open(
    row: Pick<IntegrationCredentialRecord, "provider" | "secret_ciphertext" | "key_id">
  ) {
    if (!this.key || row.key_id !== this.keyId) {
      return null
    }
    try {
      return JSON.parse(
        openSecret(row.secret_ciphertext, this.key, contextOf(row.provider))
      ) as Record<string, string>
    } catch {
      logger.error({ event: "integration_credentials.unreadable", provider: row.provider })
      return null
    }
  }

  @InjectManager()
  protected async loadAll_(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, ResolvedCredentials>> {
    const rows = await this.listIntegrationCredentials({}, {}, sharedContext)
    const resolved = new Map<string, ResolvedCredentials>()
    for (const row of rows) {
      const secrets = this.open(row)
      if (secrets) {
        resolved.set(row.provider, { settings: row.settings, secrets })
      }
    }
    return resolved
  }

  /** The account for a provider's call (cached); null when none is usable. */
  async read(provider: CredentialProviderName): Promise<ResolvedCredentials | null> {
    return (await this.cache.get()).get(provider) ?? null
  }

  /** Every provider the shop can connect, as stored now (not the cache). */
  @InjectManager()
  async describeAll(@MedusaContext() sharedContext: Context = {}): Promise<CredentialStatus[]> {
    const rows = await this.listIntegrationCredentials({}, {}, sharedContext)
    return CREDENTIAL_PROVIDER_NAMES.map((provider) => {
      const row = rows.find((candidate) => candidate.provider === provider)
      return statusOf(provider, row, row !== undefined && this.open(row) !== null)
    })
  }

  @InjectManager()
  async describe(
    provider: CredentialProviderName,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CredentialStatus> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 }, sharedContext)
    return statusOf(provider, row, row !== undefined && this.open(row) !== null)
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
    const key = this.requireKey()
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 }, sharedContext)
    const plan = planSave(provider, input, row, row ? this.open(row) : null)
    return {
      provider,
      settings: plan.settings,
      secret_ciphertext: sealSecret(JSON.stringify(plan.secrets), key, contextOf(provider)),
      needs_check: plan.needsCheck,
      secrets_changed: plan.secretsChanged,
    }
  }

  /** A draft's account in the clear, for the check against the provider; nothing keeps it. */
  openDraft(draft: CredentialDraft): ResolvedCredentials {
    const secrets = this.open({ ...draft, key_id: this.keyId ?? "" })
    if (!secrets) {
      throw new ValidationError("integration_credentials.key_missing")
    }
    return { settings: draft.settings, secrets }
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
    let previous: StoredCredential | null
    try {
      previous = await this.storeInTransaction_(draft, verification, actorId)
    } catch (error) {
      // A first save racing another inserts the provider twice; the second retries
      if (!uniqueViolationKeys(error)?.includes("provider")) {
        throw error
      }
      previous = await this.storeInTransaction_(draft, verification, actorId)
    }
    await this.cache.invalidate()
    return previous
  }

  @InjectTransactionManager()
  protected async storeInTransaction_(
    draft: CredentialDraft,
    verification: Verification | null,
    actorId: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoredCredential | null> {
    const keyId = this.keyId ?? ""
    const [row] = await this.listIntegrationCredentials(
      { provider: draft.provider },
      { take: 1 },
      sharedContext
    )
    const checked = verification ?? row?.verification ?? "unverified"
    const values = {
      settings: draft.settings,
      secret_ciphertext: draft.secret_ciphertext,
      key_id: keyId,
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

  /** The result of "test the connection" on the stored account. */
  async recordCheck(provider: CredentialProviderName, verification: Verification): Promise<void> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 })
    if (!row) {
      return
    }
    await this.updateIntegrationCredentials({
      id: row.id,
      verification,
      verified_at: verification === "verified" ? new Date() : null,
    })
    await this.cache.invalidate()
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

  /** Puts the account back as it was before a save or a removal (workflow compensation). */
  async restore(
    provider: CredentialProviderName,
    previous: StoredCredential | null
  ): Promise<void> {
    const [row] = await this.listIntegrationCredentials({ provider }, { take: 1 })
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
