import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { makeDefaultWarehouseWorkflow } from "../../../../../workflows/stock/warehouses"

/** `POST /admin/warehouses/:id/default`: the store's default warehouse, selling to its channel. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await makeDefaultWarehouseWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "" },
  })
  res.json({ warehouse: result })
}
