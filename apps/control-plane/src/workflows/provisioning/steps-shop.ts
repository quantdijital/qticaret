import { applyPresetResultSchema, applyProfileResultSchema } from "@qticaret/types/control-plane"
import { ProvisioningError } from "../../lib/provisioning/provisioner"
import { profileOf } from "../../lib/provisioning/shop-profile"
import { isPresetOf, sectorPackOf } from "../../lib/tenants/sector-packs"
import { tenantsIn } from "../modules"
import { provisionStep } from "./step"
import { command } from "./steps-setup"

/**
 * 6. The shop's profile (audit 1.3): what the wizard took (the company's
 * title, tax office, VKN and address, the owner's e-mail and phone) into
 * the shop's settings with `tenant:apply-profile`, the document on stdin.
 * The shop fills only fields it has nothing in, so a run again changes
 * nothing and the owner's own edits stay. Only before the shop is active
 * (its first setup and that setup's retries, before the owner is
 * invited): on an active shop a field the owner emptied on purpose stays
 * empty (security review L1). Only counts come back and are
 * kept. Nothing to undo: it only fills empty fields, and a failed setup's
 * database goes with its own compensation.
 */
export const profileStep = provisionStep("profile", async (input, container) => {
  const tenants = tenantsIn(container)
  const tenant = await tenants.tenantOf(input.tenant_id)
  if (tenant.status === "active") {
    return { status: "skipped", created: false, output: { active: true } }
  }
  const profile = profileOf(
    await tenants.companyOf(input.tenant_id),
    // Review L2: the owner's e-mail and phone only when they may be shown on the storefront
    tenant.storefront_contact ? await tenants.contactsOf(input.tenant_id) : []
  )
  if (!profile) {
    return { status: "skipped", created: false, output: { filled: 0 } }
  }
  const { result } = await command(container, input.tenant_id, () => ({
    name: "apply-profile",
    document: JSON.stringify(profile),
  }))
  const parsed = applyProfileResultSchema.safeParse(result.result)
  if (!parsed.success || parsed.data.status !== "applied") {
    throw new ProvisioningError("provisioning.apply_profile_result_invalid")
  }
  const { filled, kept, refused } = parsed.data
  return {
    status: filled > 0 ? "succeeded" : "skipped",
    created: false,
    output: { filled, kept, refused, duration_ms: result.duration_ms },
  }
})

interface PresetUndo {
  tenant_id: string
}

/**
 * 8. The shop's ready-made look (adr/0063 §7, task 2.7): after its sector
 * pack (the shop takes a look only of a pack it was given),
 * `tenant:apply-preset pack= preset= demo=false`. A shop that has never
 * published a design opens with it; otherwise it waits in the draft. None
 * chosen: skipped. Applied once: a run again leaves the shop's design
 * alone (skipped), so the owner's edits stay; an active shop never gets
 * a look from a setup run (security review L1). Its compensation forgets
 * that it was applied, so the setup tried again applies it again (the
 * database it went into is dropped by its own compensation, when this run
 * made it).
 */
export const presetStep = provisionStep<PresetUndo>(
  "preset",
  async (input, container) => {
    const tenants = tenantsIn(container)
    const tenant = await tenants.tenantOf(input.tenant_id)
    if (!tenant.preset) {
      return { status: "skipped", created: false, output: { preset: null } }
    }
    if (tenant.status === "active") {
      return { status: "skipped", created: false, output: { preset: tenant.preset, active: true } }
    }
    const pack = sectorPackOf(tenant)
    if (tenant.preset_applied_at) {
      return {
        status: "skipped",
        created: false,
        output: { pack, preset: tenant.preset, version: tenant.preset_version, applied: true },
      }
    }
    if (!isPresetOf(pack, tenant.preset)) {
      throw new ProvisioningError("provisioning.preset_unknown")
    }
    const preset = tenant.preset
    const { result } = await command(container, input.tenant_id, () => ({
      name: "apply-preset",
      pack,
      preset,
    }))
    const parsed = applyPresetResultSchema.safeParse(result.result)
    if (!parsed.success) {
      throw new ProvisioningError("provisioning.apply_preset_result_invalid")
    }
    if (parsed.data.status === "unknown_preset") {
      throw new ProvisioningError("provisioning.preset_unknown")
    }
    const applied = parsed.data
    if (applied.pack !== pack || applied.preset !== preset) {
      throw new ProvisioningError("provisioning.apply_preset_result_invalid")
    }
    await tenants.updateTenants({
      id: tenant.id,
      preset_version: applied.version,
      preset_applied_at: new Date(),
    })
    return {
      status: "succeeded",
      created: true,
      undo: { tenant_id: tenant.id },
      output: {
        pack,
        preset,
        version: applied.version,
        published: applied.published,
        skipped: applied.skipped,
        dropped: applied.dropped,
        duration_ms: result.duration_ms,
      },
    }
  },
  async (undo, _back, container) => {
    await tenantsIn(container).updateTenants({
      id: undo.tenant_id,
      preset_version: null,
      preset_applied_at: null,
    })
  }
)
