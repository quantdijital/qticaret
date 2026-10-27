import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { liraToKurus } from "../../validation/lira"
import { CHARGEBACKS_MODULE } from "../../../modules/chargebacks"
import type ChargebacksModuleService from "../../../modules/chargebacks/service"
import { openChargebackWorkflow } from "../../../workflows/chargebacks/open-chargeback"
import { chargebackView } from "./view"
import type { AdminGetChargebacksType, AdminPostChargebackType } from "./validators"

/**
 * GET /admin/chargebacks (F6.7, adr/0030): disputes, open ones with the
 * nearest deadline first, each with its order's number and its amount as
 * exact lira. Nothing personal.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetChargebacksType>,
  res: MedusaResponse
): Promise<void> {
  const { status, order_id, limit, offset } = req.validatedQuery
  const [chargebacks, count] = await req.scope
    .resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE)
    .listAndCountChargebacks(
      { ...(status ? { status } : {}), ...(order_id ? { order_id } : {}) },
      { take: limit, skip: offset, order: { due_at: "ASC", created_at: "DESC" } }
    )
  const { data: orders } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: [...new Set(chargebacks.map((chargeback) => chargeback.order_id))] },
  })
  const numbers = new Map(
    (orders as unknown as { id: string; display_id: number }[]).map((order) => [
      order.id,
      order.display_id,
    ])
  )
  res.json({
    chargebacks: chargebacks.map((chargeback) => ({
      ...chargebackView(chargeback),
      order_display_id: numbers.get(chargeback.order_id) ?? null,
    })),
    count,
    limit,
    offset,
  })
}

/** POST /admin/chargebacks: a dispute recorded from the provider's notice. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostChargebackType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await openChargebackWorkflow(req.scope).run({
    input: {
      order_id: body.order_id,
      amount: liraToKurus(body.amount),
      reason: body.reason,
      provider_reference: body.provider_reference ?? null,
      due_at: body.due_at ?? null,
      note: body.note ?? null,
      created_by: req.auth_context.actor_id,
    },
  })
  res.json({ chargeback: chargebackView(result) })
}
