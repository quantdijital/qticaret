import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminPostCatalogImportQuery } from "../admin/catalog/imports/validators"
import { requireUserActor } from "./actor"
import { answerAsMissing } from "./require-feature"

/**
 * Medusa's own product CSV import (and its newer file-based flow) writes
 * products past this API's checks (Turkish handles, the publish rule, the
 * preorder gate); the product sheet import replaces it (F3.9).
 */
function closeCoreProductImport(req: MedusaRequest, res: MedusaResponse) {
  answerAsMissing(req, res, "core_product_import_closed")
}

/**
 * `POST /admin/workflows-executions/:id/run` (and its step answers) runs
 * any workflow with any input, past every route check and internal job
 * type; neither the panel nor this API needs it.
 */
function closeWorkflowRuns(req: MedusaRequest, res: MedusaResponse) {
  answerAsMissing(req, res, "workflow_runs_closed")
}

const closed = (matchers: readonly string[], middleware: typeof closeCoreProductImport) =>
  matchers.map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [middleware],
  }))

/**
 * Product sheets (F3.9): the upload is its bytes, read by the route itself
 * (no body parser), and a person's: the job it starts writes the catalog.
 * The core's own import and workflow runs are closed beside it.
 */
export const CATALOG_SHEET_ROUTES = [
  {
    matcher: "/admin/catalog/imports",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [requireUserActor, validateAndTransformQuery(AdminPostCatalogImportQuery, {})],
  },
  ...closed(
    [
      "/admin/products/import",
      "/admin/products/import/:transaction_id/confirm",
      "/admin/products/imports",
      "/admin/products/imports/:transaction_id/confirm",
    ],
    closeCoreProductImport
  ),
  ...closed(
    [
      "/admin/workflows-executions/:workflow_id/run",
      "/admin/workflows-executions/:workflow_id/steps/success",
      "/admin/workflows-executions/:workflow_id/steps/failure",
    ],
    closeWorkflowRuns
  ),
]
