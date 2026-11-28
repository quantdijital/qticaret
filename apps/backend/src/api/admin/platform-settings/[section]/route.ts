import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../lib/errors"
import { AUDIT_CHANGE } from "../../../http/audit/notes"
import type { AuditChange } from "../../../http/audit/notes"
import { flattenSettings } from "../../../http/audit/resources/settings"
import { storefrontHome } from "../../../../lib/storefront/home"
import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { isSectionName } from "../../../../modules/platform-settings/sections"
import type { SectionName, SeoSettings } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import type { SectionValues } from "../../../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../../../workflows/platform-settings/update-platform-settings"
import { refuseCraftUnlessOwner } from "../../ai/craft-owner"
import { staffRoleOf } from "../../../http/staff-guard"
import type { ShippingSettings } from "../../../../modules/platform-settings/sections"
import { isSupportActor } from "../../../../lib/support-access/session"
import { supportSeoChangeRefused } from "../../../../lib/support-access/settings"

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

/** A support session keeps the storefront's canonical host as the shop set it (adr/0061 Ek). */
async function refuseHostChangeBySupport(req: AuthenticatedMedusaRequest<SectionValues>) {
  if (!isSupportActor(req.auth_context.actor_id)) {
    return
  }
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const current = (await service.readSection("seo")).values as unknown as SeoSettings
  if (supportSeoChangeRefused(req.validatedBody, current)) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "support.canonical_host")
  }
}

/**
 * Who manages the parcels (adr/0072 Ek 2026-11-26) moves when invoices
 * are due and turns our carriers' labels off: the owner's alone, as the
 * invoicing program is, while the rest of the section stays the admin's
 * too. Sending the stored value as it is stays allowed.
 */
async function refuseManagerUnlessOwner(req: AuthenticatedMedusaRequest<SectionValues>) {
  const wanted = (req.validatedBody as Partial<ShippingSettings>).manager
  if (wanted === undefined || (await staffRoleOf(req)) === "owner") {
    return
  }
  const service = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const current = (await service.readSection("shipping")).values as unknown as ShippingSettings
  if (wanted !== current.manager) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "shipping.manager_owner_only")
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
    await refuseHostChangeBySupport(req)
  }
  if (section === "shipping") {
    await refuseManagerUnlessOwner(req)
  }
  if (section === "ai_guidance") {
    await refuseCraftUnlessOwner(req, (req.validatedBody as { tasks?: unknown }).tasks)
  }
  const { result } = await updatePlatformSettingsWorkflow(req.scope).run({
    input: { section, values: req.validatedBody, actor_id: req.auth_context.actor_id || null },
  })
  // The audit diff from the row this save read under the section's lock, not
  // from reads around the request a racing save may have moved (#249)
  const change: AuditChange = {
    before: flattenSettings(result.before),
    after: flattenSettings(result.after),
  }
  res.locals[AUDIT_CHANGE] = change
  res.json(await sectionAnswer(req, section))
}
