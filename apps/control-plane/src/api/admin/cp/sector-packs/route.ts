import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sectorPackSummaries } from "../../../../lib/tenants/sector-packs"

/**
 * GET /admin/cp/sector-packs (every staff role, as the packages): the
 * sector packs a shop can be set up with (adr/0061 C12), each as its
 * manifest says (code, version, Turkish name and description) and how
 * many items of each kind it holds. Data shipped with the release: no
 * personal data, nothing a shop wrote.
 */
export function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  res.json({ sector_packs: sectorPackSummaries() })
}
