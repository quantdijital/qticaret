import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { fakeAccountingAllowed } from "../../../lib/accounting/adapters"
import { fakeInvoicingAllowed } from "../../../lib/invoicing"
import { SECTIONS, isSectionName } from "../../../modules/platform-settings/sections"
import type { SectionName } from "../../../modules/platform-settings/sections"

// Each section's body: any subset of its fields; unknown fields are refused
const SECTION_VALIDATORS = {
  store: validateAndTransformBody(SECTIONS.store.patch),
  seo: validateAndTransformBody(SECTIONS.seo.patch),
  appearance: validateAndTransformBody(SECTIONS.appearance.patch),
  inventory: validateAndTransformBody(SECTIONS.inventory.patch),
  promotions: validateAndTransformBody(SECTIONS.promotions.patch),
  payments: validateAndTransformBody(SECTIONS.payments.patch),
  bank_transfer: validateAndTransformBody(SECTIONS.bank_transfer.patch),
  cash_on_delivery: validateAndTransformBody(SECTIONS.cash_on_delivery.patch),
  shipping: validateAndTransformBody(SECTIONS.shipping.patch),
  notifications: validateAndTransformBody(SECTIONS.notifications.patch),
  marketing: validateAndTransformBody(SECTIONS.marketing.patch),
  security: validateAndTransformBody(SECTIONS.security.patch),
  legal: validateAndTransformBody(SECTIONS.legal.patch),
  returns: validateAndTransformBody(SECTIONS.returns.patch),
  compliance: validateAndTransformBody(SECTIONS.compliance.patch),
  storefront: validateAndTransformBody(SECTIONS.storefront.patch),
  maintenance: validateAndTransformBody(SECTIONS.maintenance.patch),
  theme: validateAndTransformBody(SECTIONS.theme.patch),
  payment_links: validateAndTransformBody(SECTIONS.payment_links.patch),
  ai_scenes: validateAndTransformBody(SECTIONS.ai_scenes.patch),
  ai_guidance: validateAndTransformBody(SECTIONS.ai_guidance.patch),
  catalog: validateAndTransformBody(SECTIONS.catalog.patch),
  booking: validateAndTransformBody(SECTIONS.booking.patch),
  product_badges: validateAndTransformBody(SECTIONS.product_badges.patch),
  panel_layout: validateAndTransformBody(SECTIONS.panel_layout.patch),
  // The fake programs are for the tests only: never a live shop, nor an owner trying it locally
  accounting: validateAndTransformBody(
    SECTIONS.accounting.patch.refine((body) => body.adapter !== "fake" || fakeAccountingAllowed(), {
      message: "accounting.adapter_unavailable",
    })
  ),
  invoicing: validateAndTransformBody(
    SECTIONS.invoicing.patch.refine((body) => body.provider !== "fake" || fakeInvoicingAllowed(), {
      message: "einvoice.provider_unavailable",
    })
  ),
  // A new section without a validator here fails the type check, not a request
} as const satisfies Record<SectionName, unknown>

/**
 * Validates the body by the section Express decoded from the path, so
 * `/admin/platform-settings/%73tore` is checked as `store`. An unknown
 * section passes on to the route, which answers 404 without reading it.
 */
export function validateSectionBody(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const section = (req.params as Record<string, string | undefined>)["section"] ?? ""
  if (!isSectionName(section)) {
    next()
    return
  }
  return SECTION_VALIDATORS[section](req, res, next)
}

export const AdminPostFeature = z.object({ enabled: z.boolean() }).strict()
export type AdminPostFeatureType = z.infer<typeof AdminPostFeature>
