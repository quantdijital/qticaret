import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { legalIdentity } from "../../../workflows/legal/identity"

/**
 * GET /store/legal-identity (F13.9, adr/0041 §3, adr/0048): the shop's
 * legal identity and how it is reached, for the storefront's footer, its
 * contact page and its WhatsApp buttons. Public by law or by the shop's
 * choice; what the shop has not entered comes back as null (hours: none).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const identity = await legalIdentity(req.scope)
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
      same_as: identity.same_as,
      email: identity.contact_email,
      phone: identity.contact_phone,
      whatsapp: identity.whatsapp_phone,
      opening_hours: identity.opening_hours,
      map_url: identity.map_url,
    },
  })
}
