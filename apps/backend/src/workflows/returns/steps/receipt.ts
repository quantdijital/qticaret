import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import type { ReturnLine } from "../../../lib/orders/returns"
import { refusalProblem } from "../../../lib/orders/withdrawal-rules"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import { withdrawalFactsOf } from "../policy"

export interface ReceiptRules {
  /** The order's lines outside the right of withdrawal. */
  excluded: string[]
  /** An earlier request of the order gave the outbound shipping back already. */
  shipping_refunded_before: boolean
}

/**
 * What the law says of a parcel as it is received (adr/0032 Ek
 * 2026-11-03): which of the order's lines are outside the right of
 * withdrawal (their refund then leaves the shipping to staff), and whether
 * an earlier request gave the shipping back. Units refused at receipt
 * must be a sealed good's (MSY md. 15/1-ç); anything else is refused
 * here. Reads only, under the order's returns lock.
 */
export const readReceiptRulesStep = createStep(
  "returns-read-receipt-rules",
  async (input: { id: string; order_id: string; refused: ReturnLine[] }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["items.id", "items.product_id", "items.metadata"],
      filters: { id: input.order_id },
    })
    const items =
      (
        data[0] as
          | { items?: ({ id: string; product_id?: string | null; metadata?: unknown } | null)[] }
          | undefined
      )?.items ?? []
    const { excluded, warnings } = await withdrawalFactsOf(container, items)
    // Every warning is a sealed good's today (`WITHDRAWAL_WARNINGS`)
    const problem = refusalProblem(input.refused, new Set(warnings.keys()))
    if (problem) {
      throw new ValidationError(problem, { field: "refused" })
    }
    const earlier = await container
      .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      .listReturnRequests(
        { order_id: input.order_id, refund_shipping: true, status: ["received", "refunded"] },
        { select: ["id"] }
      )
    return new StepResponse<ReceiptRules>({
      excluded: [...excluded.keys()],
      shipping_refunded_before: earlier.some((request) => request.id !== input.id),
    })
  }
)
