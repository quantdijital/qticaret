import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MESSAGE_TEMPLATES } from "../../../../lib/messaging/templates"

/** GET /admin/messaging/templates (F9.3): every message the shop sends, its kind and channels. */
export function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  res.json({
    templates: Object.values(MESSAGE_TEMPLATES).map((template) => ({
      name: template.name,
      kind: template.kind,
      channels: template.channels,
    })),
  })
}
