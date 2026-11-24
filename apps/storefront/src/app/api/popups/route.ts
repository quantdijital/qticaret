import type { StorePopupsResponse } from "@qticaret/types/popups"
import { storePublicGet } from "@/lib/store-api/server"
import { popupView, popupsOn } from "@/lib/views/popups"

export const dynamic = "force-dynamic"

// The same list for every visitor (the browser picks): kept a minute on the way, as the backend
// keeps it; never a page of its own to index
const SHARED = {
  "cache-control": "public, max-age=60, stale-while-revalidate=300",
  "x-robots-tag": "noindex",
}
const NONE = { "cache-control": "no-store", "x-robots-tag": "noindex" }

/**
 * `GET /api/popups` (adr/0080 §5–§6): the shop's live pop-ups for the
 * layout's host, asked once the page is up, from the storefront's server
 * only (adr/0046 §5: the browser never calls the backend). The backend's
 * list, kept a minute in this process as the frame's answers are, its
 * pictures as the theme draws them. Pop-ups off, or any failure: none
 * (the page goes on as it is; a failure is not kept on the way).
 */
export async function GET(): Promise<Response> {
  try {
    if (!(await popupsOn())) {
      return Response.json({ popups: [] }, { headers: SHARED })
    }
    const { popups } = await storePublicGet<StorePopupsResponse>("/store/popups")
    return Response.json({ popups: popups.map(popupView) }, { headers: SHARED })
  } catch {
    return Response.json({ popups: [] }, { headers: NONE })
  }
}
