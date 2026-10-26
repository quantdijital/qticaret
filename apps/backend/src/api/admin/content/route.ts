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

/** A new content page or blog post (F3.16): its handle from its title unless given, its path claimed. */
export async function POST(req: MedusaRequest<AdminPostContentType>, res: MedusaResponse) {
  const { kind, ...values } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({ input: { kind, values } })
  res.status(201).json({ entry: await readContentEntry(req.scope, result.id) })
}
