import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
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
