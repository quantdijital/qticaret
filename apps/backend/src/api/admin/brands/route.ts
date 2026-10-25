import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveBrandWorkflow } from "../../../workflows/brands/workflows"
import { readBrand, readBrands } from "./read"
import type { AdminGetBrandsType, AdminPostBrandType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetBrandsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readBrands(req.scope, req.validatedQuery))
}

/** A new brand (F3.11): its handle from its name unless given, its page path claimed. */
export async function POST(req: MedusaRequest<AdminPostBrandType>, res: MedusaResponse) {
  const { result } = await saveBrandWorkflow(req.scope).run({
    input: { values: req.validatedBody },
  })
  res.status(201).json({ brand: await readBrand(req.scope, result.id) })
}
