import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { CP_RATE_LIMIT_PROFILES } from "../../lib/rate-limit-profiles"
import { userIdOf } from "./caller"
import { rateLimit } from "./rate-limit"
import type { defineMiddlewares } from "@medusajs/framework/http"
import { NoBody, NoQuery } from "../admin/cp/validators"
import { PostPlan, PostPlanPrice, PostPlanUpdate } from "../admin/cp/plans/validators"
import {
  GetActivity,
  GetTenantAvailability,
  GetTenants,
  PostCompany,
  PostContact,
  PostDomain,
  PostFeatureOverride,
  PostNote,
  PostNoteUpdate,
  PostOverride,
  PostTenant,
  PostTenantPlan,
  PostTenantUpdate,
} from "../admin/cp/tenants/validators"

/**
 * What each shop and package route takes (C7), strictly: its body or
 * query. Who may call is the route table's, decided before these by the
 * staff guard.
 */

type MiddlewareConfig = Extract<Parameters<typeof defineMiddlewares>[0], { routes?: unknown }>
type MiddlewareRoute = NonNullable<MiddlewareConfig["routes"]>[number]

type Schema = Parameters<typeof validateAndTransformBody>[0]

const T = "/admin/cp/tenants"
const P = "/admin/cp/plans"

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

export const TENANT_ROUTE_MIDDLEWARES: MiddlewareRoute[] = [
  query(T, GetTenants),
  query("/admin/cp/tenant-availability", GetTenantAvailability),
  query(`${T}/:id`, NoQuery),
  query(`${T}/:id/activity`, GetActivity),
  query(P, NoQuery),
  // C12: the sector packs this control plane offers
  query("/admin/cp/sector-packs", NoQuery),
  ...[
    `${T}/:id/contacts/:contact_id`,
    `${T}/:id/domains/:domain_id`,
    `${T}/:id/notes/:note_id`,
    `${T}/:id/overrides/:key`,
    `${T}/:id/feature-overrides/:key`,
  ].map((matcher) => query(matcher, NoQuery, "DELETE")),
  body(T, PostTenant),
  body(`${T}/:id`, PostTenantUpdate),
  body(`${T}/:id/company`, PostCompany),
  {
    matcher: `${T}/:id/reveal-tckn`,
    methods: ["POST"],
    // Per staff member, every address together: a stolen session reads a few, not all
    middlewares: [
      rateLimit(() => CP_RATE_LIMIT_PROFILES.tckn_reveal, { identity: userIdOf }),
      validateAndTransformBody(NoBody),
    ],
  },
  body(`${T}/:id/contacts`, PostContact),
  body(`${T}/:id/contacts/:contact_id`, PostContact),
  body(`${T}/:id/domains`, PostDomain),
  body(`${T}/:id/domains/:domain_id/primary`, NoBody),
  body(`${T}/:id/notes`, PostNote),
  body(`${T}/:id/notes/:note_id`, PostNoteUpdate),
  body(`${T}/:id/plan`, PostTenantPlan),
  body(`${T}/:id/overrides`, PostOverride),
  body(`${T}/:id/feature-overrides`, PostFeatureOverride),
  body(P, PostPlan),
  body(`${P}/:id`, PostPlanUpdate),
  body(`${P}/:id/price`, PostPlanPrice),
  body(`${P}/:id/archive`, NoBody),
  body(`${P}/:id/restore`, NoBody),
  // Ek C10: a shop's setup takes nothing but the path (no failure injection over HTTP)
  query(`${T}/:id/provisioning`, NoQuery),
  query(`${T}/:id/provisioning/runs/:run_id`, NoQuery),
  ...["", "/stop", "/start", "/invite", "/apply-pack"].map((action) =>
    body(`${T}/:id/provisioning${action}`, NoBody)
  ),
]
