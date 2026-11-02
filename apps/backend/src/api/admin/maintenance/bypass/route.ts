import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../lib/errors"
import { orderAccessKey } from "../../../../lib/orders/access-token"
import { BYPASS_PATH, bypassToken } from "../../../../lib/storefront/maintenance"
import { brandOf } from "../../../../workflows/messaging/brand"
import { maintenanceState } from "../../../../workflows/storefront/maintenance"

/**
 * POST /admin/maintenance/bypass (adr/0053): a link that shows the dark
 * shop as it is, for a week and until the maintenance section is saved
 * again: for staff and whoever they send it to (a photographer, a tester).
 * Only while the shop is dark: turning it on would end the link anyway.
 * Recorded in the audit log as every admin write (adr/0011).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { enabled, version } = await maintenanceState(req.scope)
  if (!enabled) {
    throw new ValidationError("maintenance.not_enabled", { field: "enabled" })
  }
  const { token, expires_at } = bypassToken(orderAccessKey(), version)
  const { storefrontUrl } = await brandOf(req.scope)
  const path = `${BYPASS_PATH}?t=${token}`
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ url: storefrontUrl ? `${storefrontUrl}${path}` : path, path, expires_at })
}
