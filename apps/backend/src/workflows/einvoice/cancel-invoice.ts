import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Tells every admin, in the panel's bell, that a canceled order's invoice
 * stands and needs a return document (adr/0034 §10): an e-Fatura, an
 * e-Arşiv past its days, or one the shop's own program issued.
 */
export async function alertReturnNeeded(container: Container, invoiceId: string, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["display_id"],
    filters: { id: orderId },
  })
  const order = String((data[0] as { display_id?: number } | undefined)?.display_id ?? "")
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "einvoice.return_needed",
      resource_id: invoiceId,
      data: {
        kind: "einvoice_return_needed",
        order_id: orderId,
        display_id: order,
        ...notificationText("einvoice.return_needed", { order }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "einvoice.alert_failed", err: errorSummary(error) })
    })
}

/**
 * Asks for a canceled order's invoice to be undone (adr/0034 §10). The
 * job does it at the program, the one place that talks to it per
 * invoice; an invoice the shop's own program issued is staff's to answer
 * with a return document. Nothing to undo: an order canceled stays so.
 */
const requestCancelStep = createStep(
  "einvoice-request-cancel",
  async (input: { order_id: string }, { container }) => {
    const { needs_document } = await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .requestCancel(input.order_id)
    for (const id of needs_document) {
      await alertReturnNeeded(container, id, input.order_id)
    }
    return new StepResponse({ needs_document: needs_document.length })
  }
)

export const requestInvoiceCancelWorkflow = createWorkflow(
  "einvoice-request-cancel",
  (input: { order_id: string }) => new WorkflowResponse(requestCancelStep(input))
)
