import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteTermWorkflow,
  saveTermWorkflow,
} from "../../../../../workflows/content/term-workflows"
import { readTerm } from "../read"
import type { AdminUpdateContentTermType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ term: await readTerm(req.scope, req.params["id"] ?? "") })
}

/** Fields left out keep their values; a new handle leaves a live archive's old path to redirect. */
export async function POST(
  req: MedusaRequest<AdminUpdateContentTermType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveTermWorkflow(req.scope).run({ input: { id, values: req.validatedBody } })
  res.json({ term: await readTerm(req.scope, id) })
}

/** Never refused for its posts: a category's become uncategorised, a tag's lose it. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const { result } = await deleteTermWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "content_term", deleted: true, unlinked: result.unlinked })
}
