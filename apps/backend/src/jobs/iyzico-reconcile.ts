import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { PAYMENT_FORMS_MODULE } from "../modules/payment-forms"
import type PaymentFormsModuleService from "../modules/payment-forms/service"
import { iyzicoCallbackWorkflow } from "../workflows/payments/iyzico-callback"

// Past most shoppers' way back from the form; a fraud review can take hours, a day at most
const QUIET_MS = 5 * 60 * 1000
const GIVE_UP_MS = 24 * 60 * 60 * 1000
const PAGE = 100

/**
 * iyzico forms whose result never came back through the shopper's browser,
 * and ones iyzico's fraud check held (adr/0026 §7). Every open form we gave
 * out is asked about (`payment-forms`), its session deleted or not, through
 * the callback's own workflow, so a late callback finds the order. A form
 * still open after a day is closed with a warning: the shop checks it.
 */
export async function reconcileIyzicoSessions(
  container: MedusaContainer,
  options: { quietMs?: number } = {}
): Promise<number> {
  const forms = container.resolve<PaymentFormsModuleService>(PAYMENT_FORMS_MODULE)
  const now = Date.now()
  let placed = 0
  // Pages by id: a form closed during the run must not shift the next page
  for (let after = ""; ;) {
    const page = await forms.listPaymentForms(
      {
        provider: "iyzico",
        status: "open",
        created_at: { $lte: new Date(now - (options.quietMs ?? QUIET_MS)) },
        ...(after ? { id: { $gt: after } } : {}),
      },
      { select: ["id", "session_id", "token", "created_at"], take: PAGE, order: { id: "ASC" } }
    )
    for (const form of page) {
      if (form.created_at.getTime() < now - GIVE_UP_MS) {
        await forms.close(form.session_id, "abandoned")
        logger.warn({ event: "iyzico.form_abandoned", sessionId: form.session_id })
        continue
      }
      try {
        const { result } = await iyzicoCallbackWorkflow(container).run({
          input: { session_id: form.session_id, token: form.token },
        })
        placed += result.outcome === "paid" ? 1 : 0
      } catch (error) {
        logger.warn({
          event: "iyzico.reconcile_failed",
          sessionId: form.session_id,
          err: errorSummary(error),
        })
      }
    }
    const last = page.at(-1)
    if (page.length < PAGE || !last) {
      break
    }
    after = last.id
  }
  if (placed > 0) {
    logger.info({ event: "iyzico.reconcile", placed })
  }
  return placed
}

export default async function iyzicoReconcile(container: MedusaContainer) {
  await reconcileIyzicoSessions(container)
}

export const config = {
  name: "iyzico-reconcile",
  schedule: "*/10 * * * *",
}
