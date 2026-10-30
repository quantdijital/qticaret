import { validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaRequest } from "@medusajs/framework/http"
import { AdminGetMigrations, AdminPostMigrationQuery } from "../admin/migrations/validators"
import type { AdminPostMigrationQueryType } from "../admin/migrations/validators"
import { requireUserActor } from "./actor"
import { requireReauth } from "./reauth"

// A dry run writes nothing; applying writes the catalog and the customers
const applying = (req: MedusaRequest) =>
  (req.validatedQuery as Partial<AdminPostMigrationQueryType>).mode === "apply"

/**
 * F14 (adr/0042 §9): a shop's data moved in. The upload is its bytes, read
 * by the route itself (no body parser), and a person's: the owner, who
 * proves themselves again to apply one (the proof comes in headers).
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
    matcher: "/admin/migrations",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetMigrations, {})],
  },
]
