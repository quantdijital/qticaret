import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveTermWorkflow } from "../../../../workflows/content/term-workflows"
import { readTerm, readTermList } from "./read"
import type { AdminGetContentTermsType, AdminPostContentTermType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetContentTermsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readTermList(req.scope, req.validatedQuery))
}

/**
 * A new blog category or tag (adr/0019 ek 2026-11-03): its handle from its
 * name unless given, one per kind; its archive path claimed.
 */
export async function POST(req: MedusaRequest<AdminPostContentTermType>, res: MedusaResponse) {
  const { kind, ...values } = req.validatedBody
  const { result } = await saveTermWorkflow(req.scope).run({ input: { kind, values } })
  res.status(201).json({ term: await readTerm(req.scope, result.id) })
}
