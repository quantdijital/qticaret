import type { InferTypeOf } from "@medusajs/framework/types"
import type { IntegrationCredential } from "./models/integration-credential"
import type { CredentialProviderName } from "./providers"

export type IntegrationCredentialRecord = InferTypeOf<typeof IntegrationCredential>

export interface IntegrationCredentialsModuleOptions {
  /** `CREDENTIALS_ENCRYPTION_KEY`, 64 hex characters; without it nothing can be saved or read. */
  encryptionKey?: string
  /** Shared version counter across processes; without it each process trusts its own writes. */
  redisUrl?: string
  versionKey?: string
}

export type Verification = "verified" | "unverified"

/**
 * - `not_configured`: nothing saved
 * - `connected`: saved and accepted by the provider
 * - `unverified`: saved, the provider could not be asked
 * - `unreadable`: saved under another key; enter it again
 */
export type CredentialState = "not_configured" | "connected" | "unverified" | "unreadable"

/** What the panel sees: never a secret, nor any part of one. */
export interface CredentialStatus {
  provider: CredentialProviderName
  state: CredentialState
  settings: Record<string, unknown> | null
  /** Each secret field and whether it is stored. */
  secrets: Record<string, boolean>
  secrets_version: number
  verified_at: Date | null
  updated_at: Date | null
  updated_by: string | null
}

/** Decrypted, for the provider's calls only. */
export interface ResolvedCredentials {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}

/**
 * A save checked and sealed before it reaches a workflow: the workflow's
 * input and steps never carry a secret in the clear.
 */
export interface CredentialDraft {
  provider: CredentialProviderName
  settings: Record<string, unknown>
  secret_ciphertext: string
  /** The account or a secret changed: the provider is asked before it is saved. */
  needs_check: boolean
  secrets_changed: boolean
}

/** The row before a change, for a compensation to put back; null when there was none. */
export interface StoredCredential {
  settings: Record<string, unknown>
  secret_ciphertext: string
  key_id: string
  secrets_version: number
  verification: Verification
  verified_at: Date | null
  updated_by: string | null
}
