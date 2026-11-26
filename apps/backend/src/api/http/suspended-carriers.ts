import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isSuspendedProvider } from "../../lib/integrations/suspended"

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const providerOf = (option: Row): string | null => {
  const provider = option["provider"]
  const id = option["provider_id"] ?? (isRow(provider) ? provider["id"] : null)
  return typeof id === "string" ? id : null
}

/** A Store answer listing shipping options, without those of a suspended carrier. */
export function withoutSuspendedOptions(body: unknown): unknown {
  if (!isRow(body) || !Array.isArray(body["shipping_options"])) {
    return body
  }
  return {
    ...body,
    shipping_options: body["shipping_options"].filter(
      (option) => !isRow(option) || !isSuspendedProvider(providerOf(option))
    ),
  }
}

/**
 * Checkout's shipping options (`GET /store/shipping-options`, Medusa's own
 * route) leave out a suspended carrier's (`lib/integrations/suspended.ts`):
 * an option the shop made before the suspension is not offered. The
 * carrier's provider refuses it too, should a cart name it anyway.
 */
export function hideSuspendedCarrierOptions(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (req.method === "GET") {
    const json = res.json.bind(res)
    res.json = (body: unknown) => json(withoutSuspendedOptions(body))
  }
  next()
}
