import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { BirfaturaMessage } from "../../../../../lib/invoicing/birfatura"
import { errorSummary, logger } from "../../../../../lib/logging"
import { readCargoTracking } from "../../../../../lib/shipping/birfatura-cargo"
import type { CargoDecision } from "../../../../../lib/shipping/birfatura-cargo"
import { birfaturaShips } from "../../../../../lib/shipping/manager"
import { birfaturaCargoWorkflow } from "../../../../../workflows/shipping/birfatura-cargo"
import { answer, auditBirfatura, cargoRefusalCode } from "../../respond"
import type { BirfaturaCargoBodyType } from "../../validators"

const REFUSALS: Readonly<Record<string, BirfaturaMessage>> = {
  unknown_order: "cargo_unknown_order",
  exchange: "cargo_exchange",
  canceled: "cargo_canceled",
  tracking_invalid: "cargo_tracking_invalid",
}

/**
 * POST /hooks/birfatura/api/orderCargoUpdate (adr/0072 §6, Ek 2026-11-26).
 * While the shop's own contracts carry its parcels, taken and set aside: a
 * second source of tracking would fight theirs. While BirFatura's cargo
 * module manages them (Settings > Shipping), its tracking number ships the
 * order whole (`birfaturaCargoWorkflow`): once, the same number again
 * changes nothing. Logged and recorded by ids only, never the tracking
 * number, its link or the buyer.
 */
export async function POST(
  req: MedusaRequest<BirfaturaCargoBodyType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  if (!(await birfaturaShips(req.scope))) {
    logger.info({ event: "birfatura.cargo_update_ignored", birfatura_order_id: body.orderId })
    answer(res, true, "cargo_ignored")
    return
  }
  let decision: CargoDecision | null = null
  let code: string | null = null
  try {
    const { result } = await birfaturaCargoWorkflow(req.scope).run({
      input: { birfatura_order_id: body.orderId, tracking: readCargoTracking(body) },
    })
    decision = result
  } catch (error) {
    code = cargoRefusalCode(error)
    logger.warn({
      event: "birfatura.cargo_update_refused",
      birfatura_order_id: body.orderId,
      code,
      // The error's name only: a message from deeper down might quote what BirFatura sent
      err_name: error instanceof Error ? error.name : null,
    })
  }
  await auditBirfatura(req, {
    kind: "mutation",
    action: "birfatura.cargo_updated",
    resource_type: "order",
    resource_id: decision?.order_id ?? null,
    outcome: 200,
    changes: {
      birfatura_order_id: body.orderId,
      result: decision?.action ?? "failed",
      problem: decision?.action === "refuse" ? decision.reason : code,
    },
  }).catch((error: unknown) => {
    logger.error({
      event: "audit.write_failed",
      action: "birfatura.cargo_updated",
      err: errorSummary(error),
    })
  })
  if (!decision) {
    answer(res, false, code === "orders.nothing_to_ship" ? "cargo_nothing_left" : "cargo_refused")
  } else if (decision.action === "refuse") {
    answer(res, false, REFUSALS[decision.reason] ?? "cargo_refused")
  } else {
    answer(res, true, "cargo_shipped")
  }
}
