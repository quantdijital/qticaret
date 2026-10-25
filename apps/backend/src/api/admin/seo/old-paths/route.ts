import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { AdminGetOldPathsType } from "../redirects/validators"
import { readOldPaths } from "./read"

export async function GET(
  req: MedusaRequest<unknown, AdminGetOldPathsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readOldPaths(req.scope, req.validatedQuery))
}
