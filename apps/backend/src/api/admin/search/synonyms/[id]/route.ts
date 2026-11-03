import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteSynonymWorkflow,
  saveSynonymWorkflow,
} from "../../../../../workflows/search/synonyms"
import { readSynonym } from "../read"
import type { AdminPostSearchSynonymType } from "../validators"

/** A group's terms replaced. */
export async function POST(
  req: MedusaRequest<AdminPostSearchSynonymType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveSynonymWorkflow(req.scope).run({ input: { id, terms: req.validatedBody.terms } })
  res.json({ synonym: await readSynonym(req.scope, id) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteSynonymWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "search_synonym", deleted: true })
}
