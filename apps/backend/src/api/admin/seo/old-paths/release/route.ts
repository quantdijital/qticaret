import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { releasePathWorkflow } from "../../../../../workflows/seo/redirects/workflows"
import type { AdminPostReleasePathType } from "../../redirects/validators"

/** Gives an old path up: its redirect or 410 stops, another record may take it. */
export async function POST(
  req: MedusaRequest<AdminPostReleasePathType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await releasePathWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ path: result.path, released: true })
}
