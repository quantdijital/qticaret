import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { draftLayout } from "../../draft"
import { sessionRow } from "../../access"

/**
 * GET /store/storefront-layout/session/:token (adr/0065 §1): the draft as
 * last saved, for the theme editor's live preview, with its `edition` (the
 * moment it was saved). The token opens only while its session is kept,
 * the panel session it was opened from is still signed in as the same
 * staff member, and they still write the design: a sign-out, a password
 * change, a role taken away or the editor closed ends it. Anything else,
 * Redis out of reach included, is a 404 (the panel falls back to signed
 * links). Never kept by anyone.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store")
  const { row, edition } = await sessionRow(req)
  res.json({ layout: await draftLayout(req, row), edition })
}
