import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ProgramType } from "../../../../../lib/booking/program"
import { setProgramWorkflow } from "../../../../../workflows/booking/program"
import { readProgram } from "../../../../../workflows/booking/program-view"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

/** GET /admin/products/:id/program: a dated product's steps (adr/0078). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readProgram(req.scope, idOf(req)))
}

/** POST /admin/products/:id/program: the whole program; no steps clears it. */
export async function POST(
  req: AuthenticatedMedusaRequest<ProgramType>,
  res: MedusaResponse
): Promise<void> {
  await setProgramWorkflow(req.scope).run({
    input: { product_id: idOf(req), program: req.validatedBody },
  })
  res.json(await readProgram(req.scope, idOf(req)))
}
