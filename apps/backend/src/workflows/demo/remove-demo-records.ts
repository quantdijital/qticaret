import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { deleteReservationsByLineItemsWorkflow } from "@medusajs/medusa/core-flows"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"

/**
 * Takes demo records out of a development database (`demo:remove`).
 * Medusa has no workflow that deletes an order: the Order Module's soft
 * delete is used, so each step can bring back what it took if a later one
 * fails. Development databases only; the script refuses anywhere else.
 */

/** The demo orders' invoices (a test program may have issued them), soft-deleted. */
const softDeleteDemoInvoicesStep = createStep(
  "demo-soft-delete-invoices",
  async (orderIds: string[], { container }) => {
    const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const found =
      orderIds.length > 0
        ? await invoices.listInvoices({ order_id: orderIds }, { select: ["id"] })
        : []
    const ids = found.map((invoice) => invoice.id)
    if (ids.length > 0) {
      await invoices.softDeleteInvoices(ids)
    }
    return new StepResponse(ids.length, ids)
  },
  async (ids, { container }) => {
    if (ids?.length) {
      await container.resolve<EinvoiceModuleService>(EINVOICE_MODULE).restoreInvoices(ids)
    }
  }
)

/** The orders themselves, soft-deleted: lists, reports and the dashboard no longer see them. */
const softDeleteDemoOrdersStep = createStep(
  "demo-soft-delete-orders",
  async (orderIds: string[], { container }) => {
    if (orderIds.length > 0) {
      await container.resolve(Modules.ORDER).softDeleteOrders(orderIds)
    }
    return new StepResponse(orderIds.length, orderIds)
  },
  async (ids, { container }) => {
    if (ids?.length) {
      await container.resolve(Modules.ORDER).restoreOrders(ids)
    }
  }
)

export interface RemoveDemoOrdersInput {
  order_ids: string[]
  /** Their line items: an order not shipped yet still holds stock for them. */
  line_item_ids: string[]
}

/**
 * Demo orders out: their stock reservations released first (Medusa's own
 * workflow), so the demo products can be deleted after; then their
 * invoices and the orders.
 */
export const removeDemoOrdersWorkflow = createWorkflow(
  "demo-remove-orders",
  (input: WorkflowData<RemoveDemoOrdersInput>) => {
    deleteReservationsByLineItemsWorkflow.runAsStep({ input: { ids: input.line_item_ids } })
    const invoices = softDeleteDemoInvoicesStep(input.order_ids)
    const orders = softDeleteDemoOrdersStep(input.order_ids)
    return new WorkflowResponse({ orders, invoices })
  }
)

/** Job records (an e2e run's sheet checks), soft-deleted. */
const softDeleteJobsStep = createStep(
  "demo-soft-delete-jobs",
  async (ids: string[], { container }) => {
    if (ids.length > 0) {
      await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).softDeleteAsyncJobs(ids)
    }
    return new StepResponse(ids.length, ids)
  },
  async (ids, { container }) => {
    if (ids?.length) {
      await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).restoreAsyncJobs(ids)
    }
  }
)

export const removeLeftoverJobsWorkflow = createWorkflow(
  "demo-remove-jobs",
  (input: WorkflowData<{ ids: string[] }>) => new WorkflowResponse(softDeleteJobsStep(input.ids))
)
