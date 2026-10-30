import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaRequest } from "@medusajs/framework/http"
import {
  AdminGetMigrations,
  AdminPostMigrationQuery,
  AdminPostShopifyMigration,
} from "../admin/migrations/validators"
import type {
  AdminPostMigrationQueryType,
  AdminPostShopifyMigrationType,
} from "../admin/migrations/validators"
import { requireUserActor } from "./actor"
import { requireReauth } from "./reauth"

// A dry run writes nothing; applying writes the catalog and the customers
const applying = (req: MedusaRequest) =>
  (req.validatedQuery as Partial<AdminPostMigrationQueryType>).mode === "apply"
const applyingStore = (req: MedusaRequest) =>
  (req.validatedBody as Partial<AdminPostShopifyMigrationType>).mode === "apply"

/**
 * F14 (adr/0042 §9): a shop's data moved in, by a person: the owner, who
 * proves themselves again to apply one (the proof comes in headers). A
 * bundle's upload is its bytes, read by the route itself (no body
 * parser); a Shopify store's is the connected one, named by nothing sent.
 */
export const MIGRATION_ROUTES = [
  {
    matcher: "/admin/migrations",
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
    matcher: "/admin/migrations",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMigrations, {})],
  },
]
