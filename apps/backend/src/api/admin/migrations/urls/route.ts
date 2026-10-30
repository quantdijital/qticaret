import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { urlPage } from "../../../../workflows/migration/urls-read"
import type { AdminGetMigrationUrlsType } from "../validators"

/** `GET /admin/migrations/urls` (F14.7): the old site's addresses, what each answers and what an apply does. */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetMigrationUrlsType>,
  res: MedusaResponse
): Promise<void> {
  const { filter, offset } = req.validatedQuery
  res.json(await urlPage(req.scope, filter, offset))
}
