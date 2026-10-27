import type { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../lib/errors"
import { CREDENTIAL_PROVIDERS } from "./providers"
import type { CredentialProviderName } from "./providers"
import type { CredentialStatus, IntegrationCredentialRecord } from "./types"

/** The service's decisions as plain functions: what a save needs, what the panel is shown. */

/** A Zod error as a ValidationError with its first issue's i18n key and field. */
function toValidationError(error: z.ZodError, prefix: string): ValidationError {
  const issue = error.issues[0]
  const key =
    issue?.message && /^[a-z_]+\.[a-z_]+$/.test(issue.message)
      ? issue.message
      : "integration_credentials.invalid"
  const field = [prefix, ...(issue?.path ?? []).map(String)].filter(Boolean).join(".")
  return new ValidationError(key, { field })
}

export interface SaveInput {
  settings: unknown
  /** Blank or missing: keep the stored value. */
  secrets?: Record<string, string | null | undefined> | undefined
}

export interface PlannedSave {
  settings: Record<string, unknown>
  secrets: Record<string, string>
  needsCheck: boolean
  secretsChanged: boolean
}

/**
 * What a save stores: the settings checked, the secrets sent over the
 * stored ones. A changed account number, or stored secrets that no longer
 * open (`current` null), ask for every secret again (adr/0027 §5).
 */
export function planSave(
  provider: CredentialProviderName,
  input: SaveInput,
  row: Pick<IntegrationCredentialRecord, "settings" | "verification"> | undefined,
  current: Record<string, string> | null
): PlannedSave {
  const definition = CREDENTIAL_PROVIDERS[provider]
  const parsed = definition.settings.safeParse(input.settings)
  if (!parsed.success) {
    throw toValidationError(parsed.error, "settings")
  }
  const settings = parsed.data as Record<string, unknown>
  const names: readonly string[] = definition.secrets
  const given: Record<string, string> = {}
  for (const [name, value] of Object.entries(input.secrets ?? {})) {
    if (!names.includes(name)) {
      throw new ValidationError("integration_credentials.invalid", { field: `secrets.${name}` })
    }
    if (value === null || value === undefined || value.trim() === "") {
      continue
    }
    const secret = definition.secret.safeParse(value)
    if (!secret.success) {
      throw toValidationError(secret.error, `secrets.${name}`)
    }
    given[name] = secret.data
  }

  const stored = row?.settings
  const sameAccount =
    current !== null && definition.identity.every((name) => stored?.[name] === settings[name])
  const kept = sameAccount ? current : {}
  const missing = names.find((name) => !(given[name] ?? kept[name]))
  if (missing) {
    throw new ValidationError("integration_credentials.secrets_required", {
      field: `secrets.${missing}`,
    })
  }
  const secrets = { ...kept, ...given }
  const secretsChanged = names.some((name) => secrets[name] !== current?.[name])
  return {
    settings,
    secrets,
    needsCheck: !sameAccount || secretsChanged || row?.verification !== "verified",
    secretsChanged,
  }
}

/** What the panel sees of a provider's account: never a secret, nor any part of one. */
export function statusOf(
  provider: CredentialProviderName,
  row: IntegrationCredentialRecord | undefined,
  readable: boolean
): CredentialStatus {
  const names = CREDENTIAL_PROVIDERS[provider].secrets
  if (!row) {
    return {
      provider,
      state: "not_configured",
      settings: null,
      secrets: Object.fromEntries(names.map((name) => [name, false])),
      secrets_version: 0,
      verified_at: null,
      updated_at: null,
      updated_by: null,
    }
  }
  return {
    provider,
    state: !readable ? "unreadable" : row.verification === "verified" ? "connected" : "unverified",
    settings: row.settings,
    secrets: Object.fromEntries(names.map((name) => [name, readable])),
    secrets_version: row.secrets_version,
    verified_at: row.verified_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  }
}
