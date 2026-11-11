import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { parseSigningKey, signDocument } from "@qticaret/server-kit"
import type { DocumentSignature } from "@qticaret/server-kit"
import type { SigningKeyView } from "../../modules/vault/service"
import { vaultIn } from "../../workflows/modules"
import { PLATFORM_OWNER } from "./secret-names"

type Container = Pick<MedusaContainer, "resolve">

/** The keys a shop should trust, as its `CONTROL_PLANE_PUBLIC_KEYS` lists them. */
export interface PublishedKeys {
  keys: { kid: string; public_key: string; status: SigningKeyView["status"] }[]
  /** The env line for the shops (C9): comma-separated public keys, signing key first. */
  env_value: string
}

const PUBLISHED: readonly SigningKeyView["status"][] = ["active", "next", "previous"]

/**
 * Published: the signing key, the one about to sign and the one that just
 * stopped (its documents still verify while the shops move over). Retired
 * keys are left out.
 */
export async function publishedKeys(container: Container): Promise<PublishedKeys> {
  const keys = (await vaultIn(container).publishedSigningKeys())
    .filter((key) => PUBLISHED.includes(key.status))
    .sort((a, b) => PUBLISHED.indexOf(a.status) - PUBLISHED.indexOf(b.status))
    .map(({ kid, public_key, status }) => ({ kid, public_key, status }))
  return { keys, env_value: keys.map((key) => key.public_key).join(",") }
}

/**
 * A document signed with the control plane's `active` key (adr/0061 §3.2):
 * its seed opened in memory for this one signature. C9 pushes the result.
 */
export async function signWithActiveKey(
  container: Container,
  purpose: string,
  document: unknown
): Promise<DocumentSignature> {
  const vault = vaultIn(container)
  const active = await vault.signingKeyIn("active")
  if (!active) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.signing_no_key")
  }
  const seed = await vault.openSecret(PLATFORM_OWNER, active.secret_name)
  try {
    const signer = parseSigningKey(seed.toString("utf8"), "cp_signing_key")
    // The sealed seed belongs to this row's public key, or nothing is signed
    if (signer.kid !== active.kid) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.signing_key_mismatch")
    }
    return signDocument(purpose, document, signer)
  } finally {
    seed.fill(0)
  }
}

/** A shop's plan document, signed (C9 builds and pushes it). */
export const signPlanDocument = (container: Container, document: unknown) =>
  signWithActiveKey(container, "plan", document)
