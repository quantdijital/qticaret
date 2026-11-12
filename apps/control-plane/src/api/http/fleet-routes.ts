import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { defineMiddlewares } from "@medusajs/framework/http"
import { NoQuery } from "../admin/cp/validators"
import { PostRelease, PostReleaseNotes, PostTargetRelease } from "../admin/cp/releases/validators"

/**
 * What the release and dashboard routes take (Ek C18), strictly. Who may
 * call is the route table's (lib/staff/route-table-fleet.ts), decided
 * before these by the staff guard.
 */

type MiddlewareConfig = Extract<Parameters<typeof defineMiddlewares>[0], { routes?: unknown }>
type MiddlewareRoute = NonNullable<MiddlewareConfig["routes"]>[number]

const body = (
  matcher: string,
  schema: Parameters<typeof validateAndTransformBody>[0]
): MiddlewareRoute => ({
  matcher,
  methods: ["POST"],
  middlewares: [validateAndTransformBody(schema)],
})

const noQuery = (matcher: string): MiddlewareRoute => ({
  matcher,
  methods: ["GET"],
  middlewares: [validateAndTransformQuery(NoQuery, {})],
})

export const FLEET_ROUTE_MIDDLEWARES: MiddlewareRoute[] = [
  noQuery("/admin/cp/dashboard"),
  noQuery("/admin/cp/releases"),
  body("/admin/cp/releases", PostRelease),
  body("/admin/cp/releases/:id", PostReleaseNotes),
  body("/admin/cp/tenants/:id/target-release", PostTargetRelease),
]
