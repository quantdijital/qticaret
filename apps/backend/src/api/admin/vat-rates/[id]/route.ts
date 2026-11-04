import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ensureVatRegion } from "../../../../workflows/tax/region"
import { updateVatRateWorkflow } from "../../../../workflows/tax/vat-rates"
import { readVatRates } from "../read"
import type { AdminUpdateVatRateType } from "../validators"

/**
 * A rate renamed, taken out of use or brought back. Taking it out is
 * refused for the default and while a product is on its type (409, with
 * the count).
 */
export async function POST(
  req: MedusaRequest<AdminUpdateVatRateType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  const regionId = await ensureVatRegion(req.scope)
  await updateVatRateWorkflow(req.scope).run({
    input: { region_id: regionId, id, ...req.validatedBody },
  })
  const view = await readVatRates(req.scope)
  res.json({ ...view, vat_rate: view.rates.find((rate) => rate.id === id) ?? null })
}
