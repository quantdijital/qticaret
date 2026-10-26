import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateWarehouseWorkflow } from "../../../../workflows/stock/warehouses"
import type { AdminUpdateWarehouseType } from "../validators"

/** `POST /admin/warehouses/:id`: its name, and its address unless left out. */
export async function POST(
  req: MedusaRequest<AdminUpdateWarehouseType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await updateWarehouseWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", ...req.validatedBody },
  })
  res.json({ warehouse: result })
}
