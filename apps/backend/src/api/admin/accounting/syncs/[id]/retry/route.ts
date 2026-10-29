import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ACCOUNTING_MODULE } from "../../../../../../modules/accounting"
import type AccountingModuleService from "../../../../../../modules/accounting/service"

/** POST /admin/accounting/syncs/:id/retry: a stopped record tried again from the start, on the next run. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const retried = await req.scope.resolve<AccountingModuleService>(ACCOUNTING_MODULE).retry(id)
  if (!retried) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "accounting.sync_unknown")
  }
  res.json({ retried: true })
}
