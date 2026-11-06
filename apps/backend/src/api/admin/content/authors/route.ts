import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveAuthorWorkflow } from "../../../../workflows/content/author-workflows"
import { readAuthor, readAuthorList } from "./read"
import type { AdminGetContentAuthorsType, AdminPostContentAuthorType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, AdminGetContentAuthorsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readAuthorList(req.scope, req.validatedQuery))
}

/**
 * A new blog author (adr/0060): their handle from their name unless given
 * (the first free `-2`, `-3`…), their page's path claimed.
 */
export async function POST(req: MedusaRequest<AdminPostContentAuthorType>, res: MedusaResponse) {
  const { result } = await saveAuthorWorkflow(req.scope).run({
    input: { values: req.validatedBody },
  })
  res.status(201).json({ author: await readAuthor(req.scope, result.id) })
}
