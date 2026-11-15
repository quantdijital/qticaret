import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../lib/errors"
import { capabilitiesOf } from "../../../lib/staff/permissions"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { readOrderBoard } from "./read"
import type { AdminGetOrderBoardType } from "./validators"

/** Whether the person may see wholesalers by id (owner and admin, ADR-0068 §9). */
async function seesWholesalers(req: AuthenticatedMedusaRequest): Promise<boolean> {
  const role = await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .roleOf(req.auth_context.actor_id)
  return capabilitiesOf(role).wholesale
}

/**
 * The panel's order list by stage; a recorded read of personal data
 * (adr/0011). Every role that ships may read the wholesale orders (review
 * L7), but only owner and admin narrow them by wholesaler or get the
 * wholesaler's id; the others see the company's name only.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetOrderBoardType>,
  res: MedusaResponse
): Promise<void> {
  const query = req.validatedQuery
  const owner = await seesWholesalers(req)
  if (query.wholesaler && !owner) {
    throw new ValidationError("orders.wholesaler_filter_denied", { field: "wholesaler" })
  }
  const board = await readOrderBoard(req.scope, query)
  res.json(
    owner
      ? board
      : {
          ...board,
          orders: board.orders.map((order) => ({
            ...order,
            wholesaler: order.wholesaler ? { name: order.wholesaler.name } : null,
          })),
        }
  )
}
