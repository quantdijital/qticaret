import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEFAULT_UPLOAD_LIMITS } from "../../../../../../lib/security/upload"
import { uploadReviewPhotoWorkflow } from "../../../../../../workflows/customers/review-photos"
import { readRawBody } from "../../../../../http/raw-body"

/**
 * POST /store/products/:id/reviews/photos (adr/0037 §4 Ek 2026-11-04): a
 * photo for the review the signed-in customer is writing, its bytes as
 * the body (a JPEG, PNG, WebP or AVIF, at most 10 MB; checked by the bytes
 * and stored cleaned, as every upload is). Answers its id for the review's
 * `photo_ids`; nobody sees it until the shop approves that review.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const bytes = await readRawBody(req, DEFAULT_UPLOAD_LIMITS.maxBytes)
  const { result } = await uploadReviewPhotoWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      product_id: req.params["id"] ?? "",
      content: bytes.toString("base64"),
    },
  })
  res.status(201).json({ photo: { id: result.id } })
}
