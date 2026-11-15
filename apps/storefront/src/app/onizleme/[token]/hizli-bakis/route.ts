import { GET as quickView } from "@/app/api/quick-view/route"
import { isStoreApiError } from "@/lib/store-api/errors"
import { layoutPreview } from "@/lib/store-api/requests"
import { layoutPreviewToken } from "@/lib/views/layout"

// Every answer is the shopper's: never a cached page
export const dynamic = "force-dynamic"

const HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" }

/**
 * The theme editor's preview asks its quick view here (adr/0049 Ek 2026-11-15): the proxy reads
 * the token off this address, so the answer follows the draft the frame shows (its switches, its
 * card settings), never the live design. Only for a live signed design preview: `/onizleme/`
 * stays open while the shop is dark (adr/0053), so a malformed, changed or lapsed token is a 404
 * here, never the live design's answer `/api/quick-view` would refuse behind the dark shop.
 */
export async function GET(request: Request): Promise<Response> {
  const token = await layoutPreviewToken()
  try {
    if (!token || !(await layoutPreview(token))) {
      return Response.json({ message: "quick_view.not_found" }, { status: 404, headers: HEADERS })
    }
  } catch (error) {
    // As the shop's handler: the backend's 429 passed on, any other failure a 502
    const status = isStoreApiError(error) && error.status === 429 ? 429 : 502
    return Response.json({ message: "quick_view.failed" }, { status, headers: HEADERS })
  }
  return quickView(request)
}
