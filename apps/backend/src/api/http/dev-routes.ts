import { validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { parseEnv } from "../../lib/env"
import { DevGetCheckoutOrder } from "../dev/checkout/order/validators"

/** Developer tools under `/dev` (adr/0028) exist on a developer's machine only. */
export function assertDevelopment(): void {
  if (parseEnv().NODE_ENV !== "development") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found")
  }
}

function developmentOnly(_req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    assertDevelopment()
    next()
  } catch (error) {
    next(error)
  }
}

// The handlers check again: a path the matcher misses still answers 404
export const DEV_ROUTES = [
  { matcher: "/dev/*", middlewares: [developmentOnly] },
  {
    matcher: "/dev/checkout/order",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(DevGetCheckoutOrder, {})],
  },
]
