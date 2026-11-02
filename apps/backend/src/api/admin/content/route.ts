import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveContentWorkflow } from "../../../workflows/content/workflows"
import { readContentEntry, readContentList } from "./read"
import type { AdminGetContentType, AdminPostContentType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetContentType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readContentList(req.scope, req.validatedQuery))
}

/**
 * A new content page or blog post (F3.16): its handle from its title unless
 * given, its path claimed, a post filed under its category and tags.
 */
export async function POST(req: MedusaRequest<AdminPostContentType>, res: MedusaResponse) {
  const { kind, category_id, tag_ids, ...values } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({
    input: { kind, values, terms: { category_id, tag_ids } },
  })
  res.status(201).json({ entry: await readContentEntry(req.scope, result.id) })
}
