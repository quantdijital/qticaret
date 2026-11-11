import type { InferTypeOf } from "@medusajs/framework/types"
import type { IntegrationCredential } from "./models/integration-credential"
import type { CredentialProviderName } from "./providers"

export type IntegrationCredentialRecord = InferTypeOf<typeof IntegrationCredential>

/**
 * The keys are not options: they are read from the environment where they
 * are used (`CREDENTIALS_ENCRYPTION_KEYS`, or `CREDENTIALS_ENCRYPTION_KEY`;
 * lib/integrations/credential-keys.ts), so a rotation's key list is one
 * value everywhere. Without a key nothing can be saved or read.
 */
export interface IntegrationCredentialsModuleOptions {
  /** Shared version counter across processes; without it each process trusts its own writes. */
  redisUrl?: string
  versionKey?: string
}

export type Verification = "verified" | "unverified" | "rejected"

/**
 * - `not_configured`: nothing saved
 * - `connected`: saved and accepted by the provider
 * - `unverified`: saved, the provider could not be asked
 * - `rejected`: the provider refused the stored details when tested again
 * - `unreadable`: saved under a key the server no longer has, or damaged; enter it again
 */
export type CredentialState =
  "not_configured" | "connected" | "unverified" | "rejected" | "unreadable"

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
  /** A checked account works now: an unreachable provider must not replace it unchecked. */
  connected: boolean
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
