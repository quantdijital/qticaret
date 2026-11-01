import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { parseEnv } from "../../lib/env"

/**
 * Developer tools under `/dev` (adr/0028) exist on a developer's machine
 * only: the storefront's demo key. The payment test page went with the
 * storefront's own checkout (F18 D7, 2026-11-02).
 */
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
export const DEV_ROUTES = [{ matcher: "/dev/*", middlewares: [developmentOnly] }]
