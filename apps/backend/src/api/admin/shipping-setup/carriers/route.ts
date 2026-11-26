import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { offeredCarriers } from "../../../../lib/integrations/suspended"

/**
 * GET /admin/shipping-setup/carriers: the carriers a shop on this server
 * is offered, in order (a suspended one left out; `lib/integrations/
 * suspended.ts`). Every panel screen that names carriers reads it: the
 * carrier list, the option editor, the return code picker, the board's
 * filter.
 */
export function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  res.json({ carriers: offeredCarriers() })
}
