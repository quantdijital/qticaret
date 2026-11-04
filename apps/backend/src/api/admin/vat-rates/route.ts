import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ensureVatRegion } from "../../../workflows/tax/region"
import { createVatRateWorkflow } from "../../../workflows/tax/vat-rates"
import { readVatRates } from "./read"
import type { AdminPostVatRateType } from "./validators"

/** The shop's KDV rates, the default among them (adr/0007 Ek 2026-11-04). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readVatRates(req.scope))
}

/** A new rate on a product type of its name; 409 while another in use has its percentage. */
export async function POST(
  req: MedusaRequest<AdminPostVatRateType>,
  res: MedusaResponse
): Promise<void> {
  const regionId = await ensureVatRegion(req.scope)
  const { result: id } = await createVatRateWorkflow(req.scope).run({
    input: { region_id: regionId, ...req.validatedBody },
  })
  const view = await readVatRates(req.scope)
  res.status(201).json({ ...view, vat_rate: view.rates.find((rate) => rate.id === id) ?? null })
}
