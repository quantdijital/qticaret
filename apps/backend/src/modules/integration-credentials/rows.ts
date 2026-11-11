import type Redis from "ioredis"
import { canonicalJson } from "@qticaret/server-kit"
import { createRedisVersionSource } from "../../lib/cache"
import { logger } from "../../lib/logging"
import { createRedisClient } from "../../lib/redis"
import type {
  IntegrationCredentialsModuleOptions,
  IntegrationCredentialRecord,
  StoredCredential,
} from "./types"

/** How the service reads its rows (the sealing context, the state stamp, the copy kept for undo) and learns of others' writes. */

/**
 * adr/0027's associated data: the provider and its settings. A blob copied
 * onto another provider's row does not open, nor one whose settings (test
 * mode, the shop number) were changed in the database behind the panel's
 * back. Rows sealed before adr/0061 Ek C17 only; envelopes bind the same
 * two (`credentialContext`).
 */
export const contextOf = (provider: string, settings: Record<string, unknown>) =>
  `integration_credentials:${provider}:${canonicalJson(settings)}`

/** Names one state of the row: a check answered for an older one is not recorded. */
export const stampOf = (row: IntegrationCredentialRecord): string =>
  `${String(row.secrets_version)}:${String(new Date(row.updated_at).getTime())}`

export const storedOf = (row: IntegrationCredentialRecord): StoredCredential => ({
  settings: row.settings,
  secret_ciphertext: row.secret_ciphertext,
  key_id: row.key_id,
  secrets_version: row.secrets_version,
  verification: row.verification,
  verified_at: row.verified_at,
  updated_by: row.updated_by,
})

/** The Redis marker that tells every process of a change; null without Redis. */
export function versionSource(options: IntegrationCredentialsModuleOptions) {
  const { redisUrl } = options
  let client: Redis | undefined
  const source = redisUrl
    ? createRedisVersionSource(
        () => (client ??= createRedisClient(redisUrl, "integration_credentials")),
        options.versionKey ?? "qt:credentials:version"
      )
    : null
  const env = process.env["NODE_ENV"]
  if (!source && env !== "development" && env !== "test") {
    // Each process sees its own writes at once and others' within maxAgeMs
    logger.warn({ event: "integration_credentials.no_shared_version", nodeEnv: env ?? null })
  }
  return source
}
