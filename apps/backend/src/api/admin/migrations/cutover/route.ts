import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MIGRATION_MODULE } from "../../../../modules/migration"
import type MigrationModuleService from "../../../../modules/migration/service"
import { currentCutover } from "../../../../workflows/migration/watch"

/** `GET /admin/migrations/cutover` (F14.7): the latest cutover and until when its 404s are watched. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ cutover: await currentCutover(req.scope) })
}

/**
 * `POST /admin/migrations/cutover`: the shop's address now leads here; for
 * thirty days the storefront's 404s are watched and told to the owner.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await req.scope.resolve<MigrationModuleService>(MIGRATION_MODULE).createMigrationCutovers({
    cutover_at: new Date(),
    by: req.auth_context.actor_id || null,
  })
  res.json({ cutover: await currentCutover(req.scope) })
}
