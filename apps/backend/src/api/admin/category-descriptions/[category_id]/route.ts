import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  readCategoryDescription,
  setCategoryDescriptionWorkflow,
} from "../../../../workflows/catalog/category-description"
import type { AdminPostCategoryDescriptionType } from "../validators"

/**
 * GET /admin/category-descriptions/:category_id (adr/0075): the category's
 * plain text and its document, null when it has plain text only (the
 * panel's editor then opens the text's paragraphs).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({
    description: await readCategoryDescription(req.scope, req.params["category_id"] ?? ""),
  })
}

/**
 * POST /admin/category-descriptions/:category_id (adr/0075): the category's
 * text as a document; its plain text becomes Medusa's `description`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCategoryDescriptionType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["category_id"] ?? ""
  await setCategoryDescriptionWorkflow(req.scope).run({
    input: { category_id: id, description_doc: req.validatedBody.description_doc },
  })
  res.json({ description: await readCategoryDescription(req.scope, id) })
}
