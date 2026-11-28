import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  addPttBarcodeRangeWorkflow,
  pttBarcodeRanges,
} from "../../../../workflows/shipping/ptt-barcodes"
import type { AdminPostPttBarcodeRangeType } from "./validators"

/**
 * GET /admin/shipping-setup/ptt-barcodes (docs/entegrasyonlar/ptt.md): the
 * shop's PTT barcode ranges with what is left, and whether to ask PTT for
 * a new one soon.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await pttBarcodeRanges(req.scope))
}

/** POST /admin/shipping-setup/ptt-barcodes: a range PTT gave; refused when it overlaps one. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPttBarcodeRangeType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await addPttBarcodeRangeWorkflow(req.scope).run({ input: req.validatedBody })
  res.json(result)
}
