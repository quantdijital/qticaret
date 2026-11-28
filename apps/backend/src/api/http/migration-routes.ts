import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  AdminGetMigrationUrls,
  AdminGetMigrations,
  AdminPostFeedMigration,
  AdminPostMigrationFileQuery,
  AdminPostMigrationQuery,
  AdminPostMigrationSitemap,
  AdminPostMigrationUrlDecision,
  AdminPostShopifyMigration,
} from "../admin/migrations/validators"
import type {
  AdminPostMigrationQueryType,
  AdminPostShopifyMigrationType,
} from "../admin/migrations/validators"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { requireUserActor } from "./actor"
import { requireReauth } from "./reauth"

// A dry run writes nothing; applying writes the catalog and the customers
const applying = (req: MedusaRequest) =>
  (req.validatedQuery as Partial<AdminPostMigrationQueryType>).mode === "apply"
const applyingStore = (req: MedusaRequest) =>
  (req.validatedBody as Partial<AdminPostShopifyMigrationType>).mode === "apply"
// A run started again is applied again when it was an apply: the stored run says
const restartingApply = async (req: MedusaRequest) => {
  const [run] = await req.scope
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationRuns({ id: req.params["id"] ?? "" }, { select: ["mode"], take: 1 })
  return run?.mode !== "check"
}

/**
 * F14 (adr/0042 §9): a shop's data moved in, by a person: the owner, who
 * proves themselves again to apply one (the proof comes in headers). A
 * bundle's or WordPress export's upload is its bytes, read by the route
 * itself (no body parser); a Shopify store's is the connected one, named by nothing sent.
 */
export const MIGRATION_ROUTES = [
  {
    matcher: "/admin/migrations",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [
      requireUserActor,
      validateAndTransformQuery(AdminPostMigrationFileQuery, {}),
      requireReauth(applying),
    ],
  },
  {
    matcher: "/admin/migrations/customers",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [
      requireUserActor,
      validateAndTransformQuery(AdminPostMigrationQuery, {}),
      requireReauth(applying),
    ],
  },
  {
    matcher: "/admin/migrations/shopify",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(AdminPostShopifyMigration),
      requireReauth(applyingStore),
    ],
  },
  {
    matcher: "/admin/migrations/feed",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(AdminPostFeedMigration),
      requireReauth(applyingStore),
    ],
  },
  {
    matcher: "/admin/migrations",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMigrations, {})],
  },
  // adr/0042 Ek 2026-11-27: what moved and what each completion would take
  {
    matcher: "/admin/migrations/overview",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(z.object({}).strict(), {})],
  },
  // A run that stopped half-way, started again from its stored file
  {
    matcher: "/admin/migrations/:id/restart",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(z.object({}).strict()),
      requireReauth(restartingApply),
    ],
  },
  // F14.7: the old site's addresses; applying them writes the shop's redirects
  {
    matcher: "/admin/migrations/urls",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMigrationUrls, {})],
  },
  {
    matcher: "/admin/migrations/urls/summary",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(z.object({}).strict(), {})],
  },
  {
    matcher: "/admin/migrations/urls/:id/decision",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostMigrationUrlDecision)],
  },
  {
    matcher: "/admin/migrations/urls/sitemap",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostMigrationSitemap)],
  },
  // The export's bytes as the body, read by the route itself
  {
    matcher: "/admin/migrations/urls/search-console",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/migrations/cutover",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(z.object({}).strict(), {})],
  },
  {
    matcher: "/admin/migrations/cutover",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(z.object({}).strict())],
  },
  {
    matcher: "/admin/migrations/invites",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(z.object({}).strict(), {})],
  },
  // F14.5: it mails the shop's customers
  {
    matcher: "/admin/migrations/invites",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(z.object({}).strict()),
      requireReauth(),
    ],
  },
  // adr/0042 Ek 2026-11-27: the old addresses as a list, and their 301s made again
  {
    matcher: "/admin/migrations/urls/export",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(z.object({}).strict(), {})],
  },
  {
    matcher: "/admin/migrations/urls/rebuild",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(z.object({}).strict()),
      requireReauth(),
    ],
  },
  {
    matcher: "/admin/migrations/urls/apply",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      validateAndTransformBody(z.object({}).strict()),
      requireReauth(),
    ],
  },
]
