import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPaymentHistory } from "../../../../lib/control-plane/billing-history"

/**
 * GET /admin/plan/payments (adr/0061 Ek C20): the shop's payments to the
 * platform for Settings > Abonelik, as the control plane signs them for
 * this shop (`lib/control-plane/billing-history.ts`). Read only; the same
 * people as `/admin/plan` (owner and admin). Always 200: `state` says
 * whether there is a history to show (`ok`), none (`unmanaged`) or none
 * right now (`unavailable`).
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ payments: await readPaymentHistory() })
}
