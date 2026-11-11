import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { canonicalJsonDeep, generateEd25519KeyPair } from "@qticaret/server-kit"
import { parseAgeRecipients, sealToAgeRecipients } from "@qticaret/server-kit/escrow"
import { recordTenantKeysWorkflow } from "../../workflows/vault/tenant-keys"

/**
 * A shop's runtime secrets (adr/0061 §4.3): made, delivered, forgotten.
 * The provisioner (C10) writes them straight into the shop's secret store;
 * the control plane keeps only the shop's public key and an escrow copy
 * sealed to the offline age recipients, which it cannot open.
 */

/** 32 random bytes as hex, the backend's key and secret format. */
const HEX_SECRETS = [
  // The shop database role's password; the provisioner builds DATABASE_URL from it
  "DATABASE_PASSWORD",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "PII_ENCRYPTION_KEY",
  "PII_HASH_KEY",
  // The shop's provider accounts' KEK list (adr/0061 Ek C17): one key, a list of one
  "CREDENTIALS_ENCRYPTION_KEYS",
  "AUTH_MFA_ENCRYPTION_KEY",
  "STOREFRONT_IP_SECRET",
] as const

export const RUNTIME_SECRET_NAMES = [...HEX_SECRETS, "TENANT_SIGNING_KEY"] as const
export type RuntimeSecretName = (typeof RUNTIME_SECRET_NAMES)[number]

export interface RuntimeSecrets {
  values: Record<RuntimeSecretName, string>
  /** `TENANT_SIGNING_KEY`'s public half, the `tenant_key` row. */
  signing: { kid: string; public_key: string }
}

/** A fresh set, each value independent. Pure: nothing is written anywhere. */
export function generateRuntimeSecrets(): RuntimeSecrets {
  const pair = generateEd25519KeyPair()
  const hex = Object.fromEntries(
    HEX_SECRETS.map((name) => [name, randomBytes(32).toString("hex")])
  ) as Record<(typeof HEX_SECRETS)[number], string>
  return {
    values: { ...hex, TENANT_SIGNING_KEY: pair.seed },
    signing: { kid: pair.kid, public_key: pair.publicKey },
  }
}

/** `CP_ESCROW_RECIPIENTS`, checked again where it is used. */
export const escrowRecipients = (): string[] =>
  parseAgeRecipients(process.env["CP_ESCROW_RECIPIENTS"] ?? "", "CP_ESCROW_RECIPIENTS")

/**
 * The set as the escrow file holds it: one JSON document an operator opens
 * with the offline identity (`age -d -i <key> > secrets.json`).
 */
export async function sealRuntimeSecrets(
  tenantId: string,
  secrets: RuntimeSecrets,
  recipients: readonly string[]
): Promise<string> {
  return sealToAgeRecipients(
    canonicalJsonDeep({
      format: "qt-runtime-secrets-v1",
      tenant_id: tenantId,
      issued_at: new Date().toISOString(),
      kid: secrets.signing.kid,
      secrets: secrets.values,
    }),
    recipients
  )
}

/**
 * A shop's runtime secrets issued: made here, its public key registered
 * (`active`, or `next` in a rotation) and its escrow copy recorded; the
 * values come back to the caller alone, to be delivered and dropped. They
 * never enter a workflow, a row or a log.
 */
export async function issueTenantSecrets(
  container: MedusaContainer,
  tenantId: string
): Promise<RuntimeSecrets> {
  const recipients = escrowRecipients()
  const secrets = generateRuntimeSecrets()
  const escrow = await sealRuntimeSecrets(tenantId, secrets, recipients)
  await recordTenantKeysWorkflow(container).run({
    input: {
      tenant_id: tenantId,
      kid: secrets.signing.kid,
      public_key: secrets.signing.public_key,
      escrow,
      recipients,
    },
  })
  return secrets
}
