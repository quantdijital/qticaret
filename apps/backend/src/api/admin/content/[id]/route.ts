import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteContentWorkflow, saveContentWorkflow } from "../../../../workflows/content/workflows"
import { readContentEntry } from "../read"
import type { AdminUpdateContentType } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ entry: await readContentEntry(req.scope, req.params["id"] ?? "") })
}

/** Fields left out keep their values (a post's terms too); a new handle leaves the old path to redirect. */
export async function POST(
  req: MedusaRequest<AdminUpdateContentType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  const { category_id, tag_ids, ...values } = req.validatedBody
  await saveContentWorkflow(req.scope).run({
    input: { id, values, terms: { category_id, tag_ids } },
  })
  res.json({ entry: await readContentEntry(req.scope, id) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await deleteContentWorkflow(req.scope).run({ input: id })
  res.json({ id, object: "content_entry", deleted: true })
}
