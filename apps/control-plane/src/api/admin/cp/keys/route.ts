import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { kekStatus } from "../../../../lib/vault/kek-status"
import { publishedKeys } from "../../../../lib/vault/signing"
import { vaultIn } from "../../../../workflows/modules"

/**
 * GET /admin/cp/keys (owner): what the keys are, never what they hold
 * (adr/0061 §4, Ek C8): the signing keys (kid, status, public key, dates),
 * the published set the shops take as `CONTROL_PLANE_PUBLIC_KEYS`, and per
 * KEK fingerprint how many sealed values it holds and whether it is still
 * configured. No private key, secret value or sealed form is in it.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [keys, published, keks] = await Promise.all([
    vaultIn(req.scope).signingKeys(),
    publishedKeys(req.scope),
    kekStatus(req.scope),
  ])
  res.setHeader("Cache-Control", "no-store")
  res.json({
    signing_keys: keys.map(({ kid, public_key, status, created_at, activated_at, retired_at }) => ({
      kid,
      public_key,
      status,
      created_at,
      activated_at,
      retired_at,
    })),
    published,
    keks,
  })
}
