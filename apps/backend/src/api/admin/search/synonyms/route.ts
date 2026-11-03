import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveSynonymWorkflow } from "../../../../workflows/search/synonyms"
import { readSynonym, readSynonyms } from "./read"
import type { AdminGetSearchSynonymsType, AdminPostSearchSynonymType } from "./validators"

/** The shop's synonym groups for site search (adr/0056). */
export async function GET(
  req: MedusaRequest<unknown, AdminGetSearchSynonymsType>,
  res: MedusaResponse
): Promise<void> {
  const { q, offset, limit } = req.validatedQuery
  const { synonyms, count } = await readSynonyms(req.scope, { q, offset, limit })
  res.json({ synonyms, count, offset, limit })
}

/** A new group: searching any of its terms finds the others too. */
export async function POST(
  req: MedusaRequest<AdminPostSearchSynonymType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await saveSynonymWorkflow(req.scope).run({
    input: { terms: req.validatedBody.terms },
  })
  res.status(201).json({ synonym: await readSynonym(req.scope, result.id) })
}
