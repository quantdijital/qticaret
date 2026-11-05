import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { googleReviewLocations } from "../../../../../workflows/google/reviews"

/** GET /admin/google/reviews/locations: the Business Profile locations the account manages. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const locations = await googleReviewLocations(req.scope)
  res.json({
    locations: locations.map((each) => ({
      account: each.account,
      location: each.location,
      title: each.title,
      address: each.address,
    })),
  })
}
