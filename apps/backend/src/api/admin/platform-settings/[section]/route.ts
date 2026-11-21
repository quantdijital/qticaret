import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../lib/errors"
import { storefrontHome } from "../../../../lib/storefront/home"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { isSectionName } from "../../../../modules/platform-settings/sections"
import type { SectionName, SeoSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import type { SectionValues } from "../../../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../../../workflows/platform-settings/update-platform-settings"
import { refuseCraftUnlessOwner } from "../../ai/craft-owner"

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

/**
 * A section's answer: its stored values; the SEO section's also says where
 * the storefront opens (`storefront_url`, read only: never a stored value,
 * so a save cannot send it), for the panel's "Mağazayı görüntüle".
 */
async function sectionAnswer(req: AuthenticatedMedusaRequest, section: SectionName) {
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const stored = await service.readSection(section)
  if (section !== "seo") {
    return { section, ...stored }
  }
  const host = (stored.values as unknown as SeoSettings).canonical_host
  return { section, ...stored, storefront_url: storefrontHome(host) }
}

/** A settings section as stored, defaults filled in (adr/0012). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await sectionAnswer(req, sectionParam(req)))
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
  if (section === "ai_guidance") {
    await refuseCraftUnlessOwner(req, (req.validatedBody as { tasks?: unknown }).tasks)
  }
  await updatePlatformSettingsWorkflow(req.scope).run({
    input: { section, values: req.validatedBody, actor_id: req.auth_context.actor_id || null },
  })
  res.json(await sectionAnswer(req, section))
}
