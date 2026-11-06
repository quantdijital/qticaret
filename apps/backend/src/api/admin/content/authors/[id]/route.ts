import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  deleteAuthorWorkflow,
  saveAuthorWorkflow,
} from "../../../../../workflows/content/author-workflows"
import { readAuthor } from "../read"
import type { AdminUpdateContentAuthorType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ author: await readAuthor(req.scope, req.params["id"] ?? "") })
}

/** Fields left out keep their values; a new handle leaves a page with live posts its old path to redirect. */
export async function POST(
  req: MedusaRequest<AdminUpdateContentAuthorType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await saveAuthorWorkflow(req.scope).run({ input: { id, values: req.validatedBody } })
  res.json({ author: await readAuthor(req.scope, id) })
}

/** Never refused for their posts: the posts are left without an author. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const { result } = await deleteAuthorWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "content_author", deleted: true, unlinked: result.unlinked })
}
