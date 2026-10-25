import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../../../modules/brands"
import type BrandsModuleService from "../../../../modules/brands/service"
import { deleteBrandWorkflow, saveBrandWorkflow } from "../../../../workflows/brands/workflows"
import { readBrand } from "../read"
import type { AdminUpdateBrandType } from "../validators"

async function assertBrand(req: MedusaRequest, id: string): Promise<void> {
  const [brand] = await req.scope
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listBrands({ id }, { take: 1, select: ["id"] })
  if (!brand) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "brands.unknown")
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await assertBrand(req, id)
  res.json({ brand: await readBrand(req.scope, id) })
}

/** Fields left out keep their values; a new handle leaves the old path to redirect. */
export async function POST(
  req: MedusaRequest<AdminUpdateBrandType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveBrandWorkflow(req.scope).run({ input: { id, values: req.validatedBody } })
  res.json({ brand: await readBrand(req.scope, id) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteBrandWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "brand", deleted: true })
}
