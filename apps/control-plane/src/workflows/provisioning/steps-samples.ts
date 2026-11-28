import { loadSamplesResultSchema } from "@qticaret/types/control-plane"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import { sectorPackOf } from "../../lib/tenants/sector-packs"
import { tenantsIn } from "../modules"
import { codeOf, provisionStep } from "./step"
import type { StepOutcome } from "./step"
import { command } from "./steps-setup"

interface SamplesUndo {
  tenant_id: string
}

/** What the shop said, or a code: a problem here is a warning, never the setup's failure. */
async function loadSamples(
  container: Parameters<typeof command>[0],
  tenantId: string,
  pack: string
) {
  const { result } = await command(container, tenantId, () => ({ name: "load-samples", pack }))
  const parsed = loadSamplesResultSchema.safeParse(result.result)
  if (!parsed.success) {
    throw new ProvisioningError("provisioning.load_samples_result_invalid")
  }
  if (parsed.data.status === "unknown_samples") {
    throw new ProvisioningError("provisioning.load_samples_unknown")
  }
  if (parsed.data.status === "loaded" && parsed.data.pack !== pack) {
    throw new ProvisioningError("provisioning.load_samples_result_invalid")
  }
  return { loaded: parsed.data, duration_ms: result.duration_ms }
}

/**
 * 9. The pack's sample catalogue (the wizard's "Örnek ürünlerle başla"),
 * after the shop's look: `tenant:load-samples pack=`, the shop's own check
 * and workflow, every record marked as a sample (the owner removes them
 * from the shop panel's "Örnek içerik" card). Not asked for: skipped.
 * Loaded once: a run again skips it; an active shop never gets samples
 * from a setup run (as the look, security review L1). A load that fails
 * (refused, timed out, an answer not understood) does not fail the setup:
 * the step is skipped with the failure's code as its warning, and the
 * shop's own load (the card) or a retry of an unfinished setup tries
 * again. A set the shop has already counts as loaded. Its compensation
 * forgets that it was loaded, so the setup tried again loads it again
 * (the database it went into is dropped by its own compensation, when
 * this run made it; otherwise the shop answers `already_loaded`).
 */
export const sampleCatalogStep = provisionStep<SamplesUndo>(
  "sample_catalog",
  async (input, container): Promise<StepOutcome<SamplesUndo>> => {
    const tenants = tenantsIn(container)
    const tenant = await tenants.tenantOf(input.tenant_id)
    if (!tenant.sample_catalog) {
      return { status: "skipped", created: false, output: { requested: false } }
    }
    if (tenant.status === "active") {
      return { status: "skipped", created: false, output: { active: true } }
    }
    const pack = sectorPackOf(tenant)
    if (tenant.sample_catalog_loaded_at) {
      return { status: "skipped", created: false, output: { pack, loaded: true } }
    }
    let outcome: Awaited<ReturnType<typeof loadSamples>>
    try {
      outcome = await loadSamples(container, input.tenant_id, pack)
    } catch (error) {
      return { status: "skipped", created: false, warning: codeOf(error), output: { pack } }
    }
    await tenants.updateTenants({ id: tenant.id, sample_catalog_loaded_at: new Date() })
    const { loaded, duration_ms } = outcome
    if (loaded.status === "already_loaded") {
      return {
        status: "skipped",
        created: true,
        undo: { tenant_id: tenant.id },
        output: { pack, loaded: true, duration_ms },
      }
    }
    return {
      status: "succeeded",
      created: true,
      undo: { tenant_id: tenant.id },
      output: {
        pack,
        products: loaded.products,
        categories_made: loaded.categories_made,
        categories_opened: loaded.categories_opened,
        duration_ms,
      },
    }
  },
  async (undo, _back, container) => {
    await tenantsIn(container).updateTenants({
      id: undo.tenant_id,
      sample_catalog_loaded_at: null,
    })
  }
)
