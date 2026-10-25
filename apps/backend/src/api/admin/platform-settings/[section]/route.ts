import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { isSectionName } from "../../../../modules/platform-settings/sections"
import type { SectionName, SeoSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import type { SectionValues } from "../../../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../../../workflows/platform-settings/update-platform-settings"

function sectionParam(req: AuthenticatedMedusaRequest): SectionName {
  const section = req.params["section"] ?? ""
  if (!isSectionName(section)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "platform_settings.unknown_section")
  }
  return section
}

/**
 * A new URL style moves every page's address (docs/13 §2.2): it goes
 * through the `seo.url_style` job, which claims the new paths before it
 * saves the style. Sending the style as it is stays allowed.
 */
async function refuseStyleChange(req: AuthenticatedMedusaRequest<SectionValues>): Promise<void> {
  const wanted = (req.validatedBody as Partial<SeoSettings>).url_style
  if (!wanted) {
    return
  }
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const current = (await service.readSection("seo")).values as unknown as SeoSettings
  const changed = (Object.keys(wanted) as (keyof SeoSettings["url_style"])[]).some(
    (entity) => wanted[entity] !== current.url_style[entity]
  )
  if (changed) {
    throw new ValidationError("seo.url_style_job_required", { field: "url_style" })
  }
}

/** A settings section as stored, defaults filled in (adr/0012). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const section = sectionParam(req)
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  res.json({ section, ...(await service.readSection(section)) })
}

/** Saves the fields sent over the current values; the body was checked by the section's schema. */
export async function POST(
  req: AuthenticatedMedusaRequest<SectionValues>,
  res: MedusaResponse
): Promise<void> {
  const section = sectionParam(req)
  if (section === "seo") {
    await refuseStyleChange(req)
  }
  await updatePlatformSettingsWorkflow(req.scope).run({
    input: { section, values: req.validatedBody, actor_id: req.auth_context.actor_id || null },
  })
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  res.json({ section, ...(await service.readSection(section)) })
}
