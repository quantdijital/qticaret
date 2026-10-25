import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { AdminGetNotFoundType } from "../redirects/validators"
import { readNotFound } from "./read"

export async function GET(
  req: MedusaRequest<unknown, AdminGetNotFoundType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readNotFound(req.scope, req.validatedQuery))
}
