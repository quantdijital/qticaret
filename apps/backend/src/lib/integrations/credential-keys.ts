import { z } from "@medusajs/framework/zod"
import {
  createLocalKeyWrapper,
  kekFingerprint,
  key256,
  keyFingerprint,
  parseKey,
} from "@qticaret/server-kit"
import type { KeyWrapper } from "@qticaret/server-kit"

/**
 * The keys that seal the shop's provider accounts (adr/0027, adr/0061 §4.4,
 * Ek C17). Two forms:
 *
 * - `CREDENTIALS_ENCRYPTION_KEYS`: 64-hex keys separated by commas, newest
 *   first. The first wraps every new record's data key; the others still
 *   open what they wrapped, so a rotation is "new key first, rewrap, drop
 *   the old one". A key's id is its fingerprint (`kekFingerprint`), never a
 *   name typed beside it, so it cannot be mislabelled (adr/0061 Ek C1).
 * - `CREDENTIALS_ENCRYPTION_KEY`: one key, the form every shop had before;
 *   alone it is a one-key list. Set beside the list it must be one of its
 *   keys: a key left out of the list would silently stop opening records.
 *
 * Messages name the variable, never a value.
 */

export const MAX_CREDENTIAL_KEYS = 5

const HEX_KEY = /^[0-9a-fA-F]{64}$/

const entriesOf = (value: string): string[] => value.split(",").map((entry) => entry.trim())

/** What is wrong with a `CREDENTIALS_ENCRYPTION_KEYS` value; null when nothing is. */
export function credentialKeysProblem(value: string): string | null {
  const entries = entriesOf(value)
  if (entries.some((entry) => entry === "")) {
    return "must list keys separated by single commas, with no empty entry"
  }
  if (entries.some((entry) => !HEX_KEY.test(entry))) {
    return "must list keys of 64 hex characters (32 bytes) each"
  }
  if (entries.length > MAX_CREDENTIAL_KEYS) {
    return `must list at most ${String(MAX_CREDENTIAL_KEYS)} keys`
  }
  if (new Set(entries.map((entry) => entry.toLowerCase())).size !== entries.length) {
    return "must not list the same key twice"
  }
  return null
}

/** The two variables in the shop's env schema (lib/env.ts). */
export const CREDENTIALS_KEYS_ENV = {
  CREDENTIALS_ENCRYPTION_KEY: key256.optional(),
  CREDENTIALS_ENCRYPTION_KEYS: z
    .string()
    .max(1000)
    .superRefine((value, ctx) => {
      const problem = credentialKeysProblem(value)
      if (problem !== null) {
        ctx.addIssue({ code: "custom", message: problem })
      }
    })
    .optional(),
}

interface CredentialKeysEnv {
  CREDENTIALS_ENCRYPTION_KEY?: string | undefined
  CREDENTIALS_ENCRYPTION_KEYS?: string | undefined
}

/** The configured keys as lowercase hex, newest first; empty when none is. */
export function configuredCredentialKeys(env: CredentialKeysEnv): string[] {
  const list = env.CREDENTIALS_ENCRYPTION_KEYS
  if (list !== undefined && list !== "") {
    return entriesOf(list).map((entry) => entry.toLowerCase())
  }
  const single = env.CREDENTIALS_ENCRYPTION_KEY
  return single !== undefined && single !== "" ? [single.toLowerCase()] : []
}

/**
 * The other secrets that must each be their own (adr/0061 Ek C19 I4): one
 * value reused as two keys means one leak opens both, and a rotation of
 * one silently changes the other. Compared only when set.
 */
export const DISTINCT_SECRETS = [
  "AUTH_MFA_ENCRYPTION_KEY",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "STOREFRONT_IP_SECRET",
] as const

type SecretsEnv = CredentialKeysEnv & {
  PII_ENCRYPTION_KEY: string
  PII_HASH_KEY: string
} & Partial<Record<(typeof DISTINCT_SECRETS)[number], string | undefined>>

/** The cross-variable rules, added to the shop's schema; `deployed`: production or staging. */
export function checkCredentialKeysEnv(
  env: SecretsEnv,
  deployed: boolean,
  issue: (path: string, message: string) => void
): void {
  const list = env.CREDENTIALS_ENCRYPTION_KEYS
  const single = env.CREDENTIALS_ENCRYPTION_KEY?.toLowerCase()
  const listed = list !== undefined && credentialKeysProblem(list) === null
  if (deployed && list === undefined && single === undefined) {
    issue(
      "CREDENTIALS_ENCRYPTION_KEYS",
      "is required in production and staging (or CREDENTIALS_ENCRYPTION_KEY, one key)"
    )
  }
  if (listed && single !== undefined && !configuredCredentialKeys(env).includes(single)) {
    issue(
      "CREDENTIALS_ENCRYPTION_KEY",
      "must be one of CREDENTIALS_ENCRYPTION_KEYS when both are set: list it there after the new key, or remove it"
    )
  }
  // Provider secrets and personal data are kept apart: one key's loss or
  // rotation must not touch the other (adr/0027)
  const pii = [env.PII_ENCRYPTION_KEY, env.PII_HASH_KEY].map((key) => key.toLowerCase())
  if (single !== undefined && pii.includes(single)) {
    issue("CREDENTIALS_ENCRYPTION_KEY", "must differ from the PII keys")
  }
  const listedKeys = listed ? configuredCredentialKeys({ CREDENTIALS_ENCRYPTION_KEYS: list }) : []
  if (listedKeys.some((key) => pii.includes(key))) {
    issue("CREDENTIALS_ENCRYPTION_KEYS", "must differ from the PII keys")
  }
  // Ek C19 I4: each further secret differs from every key before it. The
  // message names the variables, never a value
  const seen: (readonly [string, string])[] = [
    ["PII_ENCRYPTION_KEY", pii[0] ?? ""],
    ["PII_HASH_KEY", pii[1] ?? ""],
    ...(single === undefined ? [] : [["CREDENTIALS_ENCRYPTION_KEY", single] as const]),
    ...listedKeys.map((key) => ["CREDENTIALS_ENCRYPTION_KEYS", key] as const),
  ]
  for (const name of DISTINCT_SECRETS) {
    const value = env[name]?.trim().toLowerCase()
    if (!value) {
      continue
    }
    const clash = seen.find(([, other]) => other === value)
    if (clash) {
      issue(name, `must differ from ${clash[0]}`)
    }
    seen.push([name, value])
  }
}

/** A configured key as the adr/0027 rows name it, with the KEK id it goes by now. */
export interface LegacyKey {
  key: Buffer
  kekId: string
}

export interface CredentialKeyring {
  /** Wraps new data keys with the first key; unwraps with any of them. */
  readonly wrapper: KeyWrapper
  /** The keys' KEK ids (`kekFingerprint`), the current first. */
  readonly kekIds: readonly string[]
  /** adr/0027 rows' `key_id` (`keyFingerprint`) → that key, to read and upgrade them. */
  readonly legacy: ReadonlyMap<string, LegacyKey>
}

let cached: { raw: string; keyring: CredentialKeyring | null } | undefined

/**
 * The keyring the environment configures, null without a key. Read from
 * the process environment (validated at boot by lib/env.ts) and rebuilt
 * only when the values change, like the control plane's `CP_MASTER_KEY`
 * (adr/0061 Ek C8). The keys stay in this process's memory.
 */
export function credentialKeyring(env: CredentialKeysEnv = process.env): CredentialKeyring | null {
  const raw = `${env.CREDENTIALS_ENCRYPTION_KEYS ?? ""}|${env.CREDENTIALS_ENCRYPTION_KEY ?? ""}`
  if (cached?.raw === raw) {
    return cached.keyring
  }
  const list = env.CREDENTIALS_ENCRYPTION_KEYS
  const problem = list === undefined || list === "" ? null : credentialKeysProblem(list)
  if (problem !== null) {
    throw new Error(`CREDENTIALS_ENCRYPTION_KEYS ${problem}`)
  }
  const keys = configuredCredentialKeys(env).map((hex) =>
    parseKey(hex, "CREDENTIALS_ENCRYPTION_KEYS")
  )
  let keyring: CredentialKeyring | null = null
  if (keys.length > 0) {
    const kekIds = keys.map(kekFingerprint)
    keyring = {
      wrapper: createLocalKeyWrapper(keys),
      kekIds,
      legacy: new Map(
        keys.map((key, index) => [keyFingerprint(key), { key, kekId: kekIds[index] ?? "" }])
      ),
    }
  }
  cached = { raw, keyring }
  return keyring
}
