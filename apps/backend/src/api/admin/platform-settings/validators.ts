import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { fakeAccountingAllowed } from "../../../lib/accounting/adapters"
import { fakeInvoicingAllowed } from "../../../lib/invoicing"
import { SECTIONS, isSectionName } from "../../../modules/platform-settings/sections"

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
  // The fake program is for a developer's machine and the tests, never a live shop
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
} as const

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
