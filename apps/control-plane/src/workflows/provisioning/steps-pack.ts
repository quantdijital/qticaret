import { applyPackResultSchema } from "@qticaret/types/control-plane"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import { isKnownSectorPack, sectorPackOf } from "../../lib/tenants/sector-packs"
import { tenantsIn } from "../modules"
import { provisionStep } from "./step"
import { command } from "./steps-setup"

/**
 * 7. The shop's sector pack (adr/0061 F17.7, Ek C12): `tenant:apply-pack
 * pack=<code>` in the shop, the code its record names (none: the general
 * pack). The shop checks the pack with its own schemas and adds only what
 * it never had, so the step runs every time, in a setup, a retry and an
 * `apply_pack` run ("Paketi yeniden uygula"): a second time it adds
 * nothing and says `skipped`. The version applied is kept on the record
 * for the shop's page. Nothing to undo: it only adds, and a failed setup's
 * database goes with its own compensation.
 */
export const sectorPackStep = provisionStep("sector_pack", async (input, container) => {
  const tenants = tenantsIn(container)
  const tenant = await tenants.tenantOf(input.tenant_id)
  const pack = sectorPackOf(tenant)
  if (!isKnownSectorPack(pack)) {
    throw new ProvisioningError("provisioning.sector_pack_unknown")
  }
  const { result } = await command(container, input.tenant_id, () => ({
    name: "apply-pack",
    pack,
  }))
  const parsed = applyPackResultSchema.safeParse(result.result)
  if (!parsed.success) {
    throw new ProvisioningError("provisioning.apply_pack_result_invalid")
  }
  if (parsed.data.status === "unknown_pack") {
    throw new ProvisioningError("provisioning.sector_pack_unknown")
  }
  const applied = parsed.data
  if (applied.pack !== pack) {
    throw new ProvisioningError("provisioning.apply_pack_result_invalid")
  }
  await tenants.updateTenants({
    id: tenant.id,
    sector_pack: pack,
    sector_pack_version: applied.version,
    sector_pack_applied_at: new Date(),
  })
  return {
    status: applied.added > 0 ? "succeeded" : "skipped",
    created: false,
    output: {
      pack,
      version: applied.version,
      added: applied.added,
      kept: applied.kept,
      skipped: applied.skipped,
      duration_ms: result.duration_ms,
    },
  }
})
