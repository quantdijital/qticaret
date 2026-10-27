import { randomBytes } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DEMO_PUBLISHABLE_KEY_TITLE } from "../../../scripts/seed/data"
import { assertDevelopment } from "../../http/dev-routes"
import { DEV_PANEL_URL, devCheckoutCsp, devCheckoutPage } from "../../../lib/dev-checkout/page"

/**
 * GET /dev/checkout (adr/0028): the storefront's payment flow by hand, on
 * the Store API. Served in development only; anywhere else it is a 404.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  assertDevelopment()
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "api_key",
    fields: ["token"],
    filters: { title: DEMO_PUBLISHABLE_KEY_TITLE, type: "publishable", revoked_at: null },
  })
  const nonce = randomBytes(16).toString("base64")
  res.setHeader("Content-Security-Policy", devCheckoutCsp(nonce))
  res.type("html").send(
    devCheckoutPage(
      {
        publishableKey: (data[0] as { token?: string } | undefined)?.token ?? null,
        panelUrl: DEV_PANEL_URL,
      },
      nonce
    )
  )
}
