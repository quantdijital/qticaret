import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { classifyLanding } from "../../../../../lib/reports/traffic"
import { TRAFFIC_SOURCES_MODULE } from "../../../../../modules/traffic-sources"
import type TrafficSourcesModuleService from "../../../../../modules/traffic-sources/service"
import { brandOf } from "../../../../../workflows/messaging/brand"
import type { StorePostCartSourceType } from "./validators"

// An empty word says nothing
const present = (value: string | undefined): string | null =>
  value === undefined || value === "" ? null : value

const hostOf = (url: string | undefined): string | null => {
  try {
    return url ? new URL(url).hostname.toLowerCase().slice(0, 253) : null
  } catch {
    return null
  }
}

/**
 * POST /store/carts/:id/source (F11.2, adr/0039 §2): the storefront tells
 * where the cart's shopper first landed from; the first answer stays.
 * Nothing of the person is kept, so it needs no cookie consent.
 */
export async function POST(
  req: MedusaRequest<StorePostCartSourceType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at"],
    filters: { id: cartId },
  })
  const cart = data[0] as { completed_at: unknown } | undefined
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const landing = req.validatedBody
  const referrerHost = hostOf(landing.referrer)
  const { storefrontUrl } = await brandOf(req.scope)
  const source = classifyLanding(
    { ...landing, referrer_host: referrerHost },
    storefrontUrl ? new URL(storefrontUrl).hostname : null
  )
  const { recorded } = await req.scope
    .resolve<TrafficSourcesModuleService>(TRAFFIC_SOURCES_MODULE)
    .recordFirst({
      cart_id: cartId,
      source,
      utm_source: present(landing.utm_source),
      utm_medium: present(landing.utm_medium),
      utm_campaign: present(landing.utm_campaign),
      referrer_host: referrerHost,
    })
  res.json({ recorded })
}
