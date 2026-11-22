import type { MedusaContainer } from "@medusajs/framework/types"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { documentLineOf, legalIdentity } from "../../../workflows/legal/identity"

/** The ETBİS QR code's image with what the media library knows of it; null without one. */
async function etbisQr(scope: MedusaContainer) {
  const store = (await scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const url = store.etbis_qr_url ?? null
  if (!url) {
    return null
  }
  const [asset] = await scope
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url }, { select: ["alt", "width", "height", "derivatives"], take: 1 })
  return {
    url,
    alt: asset?.alt ?? null,
    width: asset?.width ?? null,
    height: asset?.height ?? null,
    derivatives: asset?.derivatives ?? null,
  }
}

/**
 * GET /store/legal-identity (F13.9, adr/0041 §3, adr/0048): the shop's
 * legal identity and how it is reached, for the storefront's footer, its
 * contact page and its WhatsApp buttons; and its ETBİS QR code's image
 * (adr/0046 Ek 2026-11-04); and the licence line its trade asks it to show
 * (adr/0076 §12), null until named and numbered. Public by law or by the
 * shop's choice; what the shop has not entered comes back as null (hours:
 * none).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [identity, qr] = await Promise.all([legalIdentity(req.scope), etbisQr(req.scope)])
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    identity: {
      company_title: identity.company_title,
      mersis: identity.mersis,
      tax_office: identity.tax_office,
      tax_number: identity.tax_number,
      address: identity.address,
      kep: identity.kep,
      etbis: identity.etbis,
      etbis_qr: qr,
      same_as: identity.same_as,
      document: documentLineOf(identity),
      email: identity.contact_email,
      phone: identity.contact_phone,
      whatsapp: identity.whatsapp_phone,
      opening_hours: identity.opening_hours,
      map_url: identity.map_url,
    },
  })
}
