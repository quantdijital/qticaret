import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ACCOUNTING_ADAPTERS, fakeAccountingAllowed } from "../../../lib/accounting"
import { ACCOUNTING_MODULE } from "../../../modules/accounting"
import type AccountingModuleService from "../../../modules/accounting/service"
import { activeAccountingAdapter } from "../../../workflows/accounting/active-adapter"

// Stopped records listed for staff to try again
const STOPPED_SHOWN = 50

/**
 * GET /admin/accounting (F11.5, adr/0039 §5): the program records go to,
 * the ones that can be picked here, how many records wait, went or
 * stopped, and the stopped ones. Codes only; nothing of a customer.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { id, adapter } = await activeAccountingAdapter(req.scope)
  const records = req.scope.resolve<AccountingModuleService>(ACCOUNTING_MODULE)
  const stopped = adapter
    ? await records.listAccountingSyncs(
        { adapter: id, status: "stopped" },
        {
          select: ["id", "source_type", "source_id", "attempts", "last_error", "updated_at"],
          order: { updated_at: "DESC" },
          take: STOPPED_SHOWN,
        }
      )
    : []
  res.json({
    adapter: id,
    active: adapter !== null,
    adapters: ACCOUNTING_ADAPTERS.map((option) => ({
      id: option,
      available: option !== "fake" || fakeAccountingAllowed(),
    })),
    counts: adapter ? await records.counts(id) : { pending: 0, synced: 0, stopped: 0 },
    stopped,
  })
}
