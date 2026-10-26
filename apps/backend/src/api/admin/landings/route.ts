import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveLandingWorkflow } from "../../../workflows/content/landing-workflows"
import { readLanding, readLandings } from "./read"
import type { AdminGetLandingsType, AdminPostLandingType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetLandingsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readLandings(req.scope, req.validatedQuery))
}

/** A new facet landing page (F3.16): its category and facet, a title, a draft until published. */
export async function POST(req: MedusaRequest<AdminPostLandingType>, res: MedusaResponse) {
  const { result } = await saveLandingWorkflow(req.scope).run({
    input: { values: req.validatedBody },
  })
  res.status(201).json({ landing: await readLanding(req.scope, result.id) })
}
