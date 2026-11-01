import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DEMO_PUBLISHABLE_KEY_TITLE } from "../../../scripts/seed/data"
import { assertDevelopment } from "../../http/dev-routes"

/**
 * GET /dev/storefront-key (adr/0046 §13): the demo store's publishable key,
 * so a developer's storefront runs without copying it by hand. A publishable
 * key is public by design; still, the route exists in development only and
 * answers 404 anywhere else.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  assertDevelopment()
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "api_key",
    fields: ["token"],
    filters: { title: DEMO_PUBLISHABLE_KEY_TITLE, type: "publishable", revoked_at: null },
  })
  res.json({ publishable_key: (data[0] as { token?: string } | undefined)?.token ?? null })
}
