import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteLandingWorkflow,
  saveLandingWorkflow,
} from "../../../../workflows/content/landing-workflows"
import { readLanding } from "../read"
import type { AdminUpdateLandingType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ landing: await readLanding(req.scope, req.params["id"] ?? "") })
}

/** Fields left out keep their values; a page's category and facet stay as made. */
export async function POST(
  req: MedusaRequest<AdminUpdateLandingType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveLandingWorkflow(req.scope).run({ input: { id, values: req.validatedBody } })
  res.json({ landing: await readLanding(req.scope, id) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteLandingWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "landing_page", deleted: true })
}
