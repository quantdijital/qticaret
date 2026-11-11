import type { MedusaContainer } from "@medusajs/framework/types"
import { isPortFree } from "../../lib/provisioning/local/process"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import type { ProvisionTarget, TenantCommand } from "../../lib/provisioning/provisioner"
import { provisioner } from "../../lib/provisioning/provider"
import { RESERVED_SLUGS, SLUG_PATTERN } from "../../lib/tenants/slug"
import { publishedKeys } from "../../lib/vault/signing"
import { issueTenantSecrets } from "../../lib/vault/tenant-secrets"
import { fleetIn, plansIn, provisioningIn, tenantsIn, vaultIn } from "../modules"
import { provisionStep } from "./step"
import { contextOf } from "./target"

type Container = MedusaContainer

/** What an undo needs to find the shop again: ids, its slug and port, never a secret. */
interface Where {
  tenant_id: string
  slug: string
  port: number
}

const whereOf = (target: ProvisionTarget): Where => ({
  tenant_id: target.tenant_id,
  slug: target.slug,
  port: target.port,
})

const targetAt = (where: Where): ProvisionTarget => ({ ...where, public_keys: "" })

/**
 * 1. The shop may be set up, and its port (adr/0061 §6.2): its slug still
 * one the platform gives, its status `provisioning` (or `active`: a run
 * again changes nothing), on a package (its plan document needs one) and
 * a signing key to issue it with. The port is the shop's for good: a
 * retry reuses it.
 */
export const allocateStep = provisionStep("allocate", async (input, container) => {
  const tenant = await tenantsIn(container).tenantOf(input.tenant_id)
  if (!SLUG_PATTERN.test(tenant.slug) || RESERVED_SLUGS.has(tenant.slug)) {
    throw new ProvisioningError("provisioning.slug_invalid")
  }
  if (tenant.status !== "provisioning" && tenant.status !== "active") {
    throw new ProvisioningError("provisioning.tenant_status")
  }
  if (!(await plansIn(container).planOf(tenant.id))) {
    throw new ProvisioningError("provisioning.no_package")
  }
  if ((await publishedKeys(container)).env_value === "") {
    throw new ProvisioningError("provisioning.no_signing_key")
  }
  const { port, reused } = await provisioningIn(container).allocatePort(
    input.run_id,
    tenant.id,
    isPortFree
  )
  return { status: "succeeded", created: false, output: { port, reused } }
})

interface SecretsUndo extends Where {
  key_id: string
  escrow_id: string | null
}

/**
 * 2. Keys, runtime secrets and their escrow (adr/0061 §4.3, Ek C8), written
 * straight into the shop's store in the same step: the values exist in
 * this function's memory only, never in a step's input, output or the run.
 * There already (a store and an active key): skipped. A key without its
 * store means the secrets are lost (a `rotate_keys` run's job, later).
 */
export const secretsStep = provisionStep<SecretsUndo>(
  "secrets",
  async (input, container) => {
    const { target } = await contextOf(container, input.tenant_id)
    const seen = await provisioner().probe(target)
    const active = (await fleetIn(container).tenantKeys(target.tenant_id)).find(
      (key) => key.status === "active"
    )
    if (active && seen.secrets) {
      return { status: "skipped", created: false, output: { kid: active.kid } }
    }
    if (active) {
      throw new ProvisioningError("provisioning.secrets_lost")
    }
    if (seen.secrets) {
      // A store with no key this side: not made by any run that finished
      // or was undone. Never overwritten, so a later undo never removes what
      // this run did not make (review L1); cleared by hand
      throw new ProvisioningError("provisioning.secrets_orphaned")
    }
    const secrets = await issueTenantSecrets(container, target.tenant_id)
    const key = (await fleetIn(container).tenantKeys(target.tenant_id)).find(
      (each) => each.kid === secrets.signing.kid
    )
    const escrow = (await vaultIn(container).escrowsOf(target.tenant_id))[0] ?? null
    const undo: SecretsUndo = {
      ...whereOf(target),
      key_id: key?.id ?? "",
      escrow_id: escrow?.id ?? null,
    }
    try {
      await provisioner().writeRuntimeSecrets(target, secrets)
    } catch (error) {
      await undoSecrets(undo, container)
      throw error
    }
    return {
      status: "succeeded",
      created: true,
      output: { kid: secrets.signing.kid, escrow_version: escrow?.version ?? null },
      undo,
    }
  },
  async (undo, _run, container) => {
    await undoSecrets(undo, container)
  }
)

async function undoSecrets(undo: SecretsUndo, container: Container): Promise<void> {
  await provisioner().removeRuntimeSecrets(targetAt(undo))
  if (undo.key_id) {
    await fleetIn(container).removeTenantKey(undo.key_id)
  }
  if (undo.escrow_id) {
    await vaultIn(container).removeEscrow(undo.escrow_id)
  }
}

/** 3. The shop's database and least-privileged role (its password from the store). */
export const databaseStep = provisionStep<Where>(
  "database",
  async (input, container) => {
    const { target } = await contextOf(container, input.tenant_id)
    const { created } = await provisioner().ensureDatabase(target)
    return {
      status: created ? "succeeded" : "skipped",
      created,
      output: { created },
      undo: whereOf(target),
    }
  },
  async (where) => {
    await provisioner().dropDatabase(targetAt(where))
  }
)

/** A command of the closed list; its failure as a code, never its output. */
export async function command(
  container: Container,
  tenantId: string,
  make: (name: string) => TenantCommand
) {
  const { tenant, target } = await contextOf(container, tenantId)
  const cmd = make(tenant.name)
  const result = await provisioner().runTenantCommand(target, cmd)
  if (!result.ok) {
    throw new ProvisioningError(
      `provisioning.${cmd.name.replace(/-/g, "_")}_${result.timed_out ? "timeout" : "failed"}`
    )
  }
  return { result, target }
}

/** 4. The shop's migrations (idempotent: Medusa runs only what is new). */
export const migrateStep = provisionStep("migrate", async (input, container) => {
  const { result } = await command(container, input.tenant_id, () => ({ name: "migrate" }))
  return { status: "succeeded", created: false, output: { duration_ms: result.duration_ms } }
})

/** 5. `tenant:bootstrap store-name=` (idempotent by its own rules: region, taxes, name). */
export const bootstrapStep = provisionStep("bootstrap", async (input, container) => {
  const { result } = await command(container, input.tenant_id, (name) => ({
    name: "bootstrap",
    store_name: name,
  }))
  return { status: "succeeded", created: false, output: { duration_ms: result.duration_ms } }
})
