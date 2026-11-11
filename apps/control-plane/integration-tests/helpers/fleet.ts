import { join } from "node:path"
import type { KeyObject } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { generateEd25519KeyPair, parseSigningKey, signRequest } from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { FLEET_MODULE } from "../../src/modules/fleet"
import type FleetModuleService from "../../src/modules/fleet/service"
import { PLANS_MODULE } from "../../src/modules/plans"
import type PlansModuleService from "../../src/modules/plans/service"
import { VAULT_MODULE } from "../../src/modules/vault"
import type VaultModuleService from "../../src/modules/vault/service"

export const fleetOf = (container: MedusaContainer) =>
  container.resolve<FleetModuleService>(FLEET_MODULE)

/** The control plane's first signing key, when there is none yet. */
export async function ensureSigningKey(container: MedusaContainer): Promise<void> {
  const vault = container.resolve<VaultModuleService>(VAULT_MODULE)
  if (!(await vault.signingKeyIn("active"))) {
    await vault.prepareSigningKey()
  }
}

/** A package (straight in the module) and the shop put on it: the package's id. */
export async function packageFor(
  container: MedusaContainer,
  code: string,
  options: { limits?: Record<string, number | null>; features?: Record<string, boolean> } = {}
): Promise<string> {
  return await container.resolve<PlansModuleService>(PLANS_MODULE).createPackage({
    code,
    name: "Paket",
    price: 49_000,
    period: "monthly",
    trial_days: 0,
    grace_days: 7,
    limits: options.limits ?? { products: 500 },
    features: options.features ?? {},
  })
}

/** A key pair for a shop, registered as its `active` (or `next`) key: its signer. */
export async function shopKey(
  container: MedusaContainer,
  tenantId: string
): Promise<Ed25519Signer> {
  const pair = generateEd25519KeyPair()
  await fleetOf(container).registerTenantKey({
    tenant_id: tenantId,
    kid: pair.kid,
    public_key: pair.publicKey,
  })
  // Test-only key made just now
  return parseSigningKey(pair.seed, "test key")
}

/** Headers of a signed `GET path` as a shop sends them. */
export const signedGet = (
  path: string,
  tenantId: string,
  signer: Ed25519Signer,
  extra: { now?: number; nonce?: string } = {}
) => signRequest({ method: "GET", path, tenantId, body: "", signer, ...extra })

type PlanCheck = { ok: true } | { ok: false; code: string }

/**
 * The shop backend's own receiver checks (apps/backend lib/control-plane
 * verify.ts), loaded at run time: one process, both sides of the wire
 * (Ek C9). Not imported statically: the app's TypeScript root ends here.
 */
export function shopReceiver(): {
  checkPlanDocument: (
    raw: unknown,
    options: { publicKeys: ReadonlyMap<string, KeyObject>; tenantId: string | null }
  ) => PlanCheck
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a path outside this app's root, test only
  return require(join(__dirname, "../../../backend/src/lib/control-plane/verify")) as ReturnType<
    typeof shopReceiver
  >
}
