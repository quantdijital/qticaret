import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { defineMiddlewares } from "@medusajs/framework/http"
import { NoBody, NoQuery } from "../admin/cp/validators"

/**
 * What the key routes take (C8): nothing. Who may call is the route
 * table's (owner; every change behind a step-up), decided before these.
 */

type MiddlewareConfig = Extract<Parameters<typeof defineMiddlewares>[0], { routes?: unknown }>
type MiddlewareRoute = NonNullable<MiddlewareConfig["routes"]>[number]

const K = "/admin/cp/keys"

export const VAULT_ROUTE_MIDDLEWARES: MiddlewareRoute[] = [
  { matcher: K, methods: ["GET"], middlewares: [validateAndTransformQuery(NoQuery, {})] },
  ...[`${K}/rewrap`, `${K}/signing/prepare`, `${K}/signing/switch`, `${K}/signing/retire`].map(
    (matcher): MiddlewareRoute => ({
      matcher,
      methods: ["POST"],
      middlewares: [validateAndTransformBody(NoBody)],
    })
  ),
]
