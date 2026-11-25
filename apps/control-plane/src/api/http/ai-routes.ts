import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { defineMiddlewares } from "@medusajs/framework/http"
import { CP_RATE_LIMIT_PROFILES } from "../../lib/rate-limit-profiles"
import { NoBody, NoQuery } from "../admin/cp/validators"
import { userIdOf } from "./caller"
import { rateLimit } from "./rate-limit"
import {
  GetAiOrders,
  GetAiWallet,
  PostAiAdjust,
  PostAiDailyCap,
  PostAiOrderCancel,
  PostAiOrderPaid,
  PostAiSettings,
  PostProviderKey,
} from "../admin/cp/ai/validators"

/**
 * What the AI credits' staff routes take (adr/0085 §5), strictly. Who may
 * call (the owner, proved again for a change) is the route table's
 * (lib/staff/route-table-ai.ts), decided before these.
 */

type MiddlewareConfig = Extract<Parameters<typeof defineMiddlewares>[0], { routes?: unknown }>
type MiddlewareRoute = NonNullable<MiddlewareConfig["routes"]>[number]

type Schema = Parameters<typeof validateAndTransformBody>[0]

const A = "/admin/cp/ai"
const W = "/admin/cp/tenants/:id/ai-credits"

const body = (matcher: string, schema: Schema): MiddlewareRoute => ({
  matcher,
  methods: ["POST"],
  middlewares: [validateAndTransformBody(schema)],
})

const query = (
  matcher: string,
  schema: Parameters<typeof validateAndTransformQuery>[0],
  method: "GET" | "DELETE" = "GET"
): MiddlewareRoute => ({
  matcher,
  methods: [method],
  middlewares: [validateAndTransformQuery(schema, {})],
})

export const AI_ROUTE_MIDDLEWARES: MiddlewareRoute[] = [
  query(`${A}/settings`, NoQuery),
  body(`${A}/settings`, PostAiSettings),
  query(`${A}/providers`, NoQuery),
  body(`${A}/providers/:service`, PostProviderKey),
  query(`${A}/providers/:service`, NoQuery, "DELETE"),
  {
    matcher: `${A}/providers/:service/test`,
    methods: ["POST"],
    // Per staff member, every address together: each one calls a provider with the platform's key
    middlewares: [
      rateLimit(() => CP_RATE_LIMIT_PROFILES.ai_provider_check, { identity: userIdOf }),
      validateAndTransformBody(NoBody),
    ],
  },
  query(W, GetAiWallet),
  body(`${W}/adjust`, PostAiAdjust),
  body(`${W}/daily-cap`, PostAiDailyCap),
  query(`${A}/orders`, GetAiOrders),
  body(`${A}/orders/:id/paid`, PostAiOrderPaid),
  body(`${A}/orders/:id/cancel`, PostAiOrderCancel),
]
