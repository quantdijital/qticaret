import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ensureVatRegion } from "../../../../workflows/tax/region"
import { setDefaultVatRateWorkflow } from "../../../../workflows/tax/vat-rates"
import { readVatRates } from "../read"
import type { AdminPostVatDefaultType } from "../validators"

/**
 * The rate products on no VAT type are taxed at. The old default stays a
 * rate to choose, on a product type of its name.
 */
export async function POST(
  req: MedusaRequest<AdminPostVatDefaultType>,
  res: MedusaResponse
): Promise<void> {
  const regionId = await ensureVatRegion(req.scope)
  await setDefaultVatRateWorkflow(req.scope).run({
    input: { region_id: regionId, rate_id: req.validatedBody.rate_id },
  })
  res.json(await readVatRates(req.scope))
}
