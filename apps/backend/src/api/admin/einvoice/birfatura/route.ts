import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { birfaturaView } from "./view"

/** GET /admin/einvoice/birfatura: the connection, as the panel shows it (adr/0072). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ birfatura: await birfaturaView(req) })
}
