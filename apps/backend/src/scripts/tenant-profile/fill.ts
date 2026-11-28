import type { MedusaContainer } from "@medusajs/framework/types"
import { tenantProfileSchema } from "@qticaret/types/control-plane"
import type { ApplyProfileResult, TenantProfile } from "@qticaret/types/control-plane"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { sectionOf } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"

type ProfileSection = keyof TenantProfile

/** A field the shop has nothing in: null, or text left blank. */
const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "")

export interface SectionPlan {
  patch: Record<string, unknown>
  filled: number
  kept: number
  refused: number
}

/**
 * What one section takes from the profile: only fields the shop has
 * nothing in, each checked alone with the section's own patch schema
 * (one the shop refuses is left out, the rest still go).
 */
export function planSection(
  section: ProfileSection,
  current: Record<string, unknown>,
  given: Record<string, string | undefined>
): SectionPlan {
  const schema = sectionOf(section).patch
  const plan: SectionPlan = { patch: {}, filled: 0, kept: 0, refused: 0 }
  for (const [field, value] of Object.entries(given)) {
    if (value === undefined) {
      continue
    }
    if (!isEmpty(current[field])) {
      plan.kept += 1
      continue
    }
    const checked = schema.safeParse({ [field]: value })
    if (!checked.success) {
      plan.refused += 1
      continue
    }
    plan.patch[field] = (checked.data as Record<string, unknown>)[field]
    plan.filled += 1
  }
  return plan
}

/** The profile as sent, or null for anything that is not one. */
export function parseProfile(text: string | null): TenantProfile | null {
  if (text === null) {
    return null
  }
  try {
    const parsed = tenantProfileSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * The control plane's profile into the shop's settings (Ayarlar > Mağaza,
 * yasal bilgiler): each section through its own workflow, as the panel
 * saves it, and only where the shop has nothing yet. Run again, it finds
 * every field filled and saves nothing.
 */
export async function fillProfile(
  container: MedusaContainer,
  profile: TenantProfile
): Promise<ApplyProfileResult> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const result = { status: "applied" as const, filled: 0, kept: 0, refused: 0 }
  for (const section of ["legal", "store"] as const) {
    const current = (await settings.readSection(section)).values as Record<string, unknown>
    const plan = planSection(section, current, profile[section])
    result.filled += plan.filled
    result.kept += plan.kept
    result.refused += plan.refused
    if (plan.filled > 0) {
      await updatePlatformSettingsWorkflow(container).run({
        input: { section, values: plan.patch, actor_id: null },
      })
    }
  }
  return result
}
