import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createWarehouseWorkflow } from "../../../workflows/stock/warehouses"
import type { AdminCreateWarehouseType } from "./validators"

/** `POST /admin/warehouses`: a warehouse with its address, selling to the shop's channel. */
export async function POST(
  req: MedusaRequest<AdminCreateWarehouseType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await createWarehouseWorkflow(req.scope).run({ input: req.validatedBody })
  res.status(201).json({ warehouse: result })
}
