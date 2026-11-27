import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../../../modules/async-job"
import type AsyncJobModuleService from "../../../../modules/async-job/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../../modules/integration-credentials/service"
import { startMigrationWorkflow } from "../../../../workflows/migration/start"
import { serializeJob } from "../../async-jobs/serialize"
import type { AdminPostShopifyMigrationType } from "../validators"

/**
 * `POST /admin/migrations/shopify` (F14.2, adr/0042 §10): the store the
 * owner connected (Settings > Integrations, `shopify`) checked or moved
 * here by a `migration.run` job; nothing about the store comes in the
 * request. Applying asks the owner to prove themselves again.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShopifyMigrationType>,
  res: MedusaResponse
): Promise<void> {
  const { mode, defaults, kinds, refresh } = req.validatedBody
  const account = await req.scope
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("shopify")
  if (!account) {
    throw new ValidationError("migration.shopify_not_connected")
  }
  const { result } = await startMigrationWorkflow(req.scope).run({
    input: {
      source: "shopify",
      source_file_id: null,
      ...(kinds?.length ? { kinds } : {}),
      ...(refresh ? { refresh: [refresh] } : {}),
      mode,
      defaults,
      requested_by: req.auth_context.actor_id || null,
    },
  })
  const service = req.scope.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  res.status(202).json({ async_job: serializeJob(await service.retrieveAsyncJob(result.id)) })
}
