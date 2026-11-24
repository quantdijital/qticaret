import { storefrontEnv } from "@/lib/env"
import { storePublicPost } from "@/lib/store-api/server"
import { popupEventOf, popupIdOf } from "@/lib/views/popups"

export const dynamic = "force-dynamic"

/** The body is `{ "type": "impression" }` at most: anything longer is not one. */
const MAX_BODY = 200

const DONE = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } })

/**
 * Sent by the shop's own pages: the browser's `Origin` (a beacon and a
 * `fetch` both send it with a POST) is the storefront's, or the browser
 * says the request is same-origin. Another site's page cannot pad a
 * pop-up's counters through a visitor's browser.
 */
function fromOwnPage(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (origin !== null) {
    return origin === storefrontEnv().STOREFRONT_ORIGIN
  }
  return request.headers.get("sec-fetch-site") === "same-origin"
}

async function eventOf(request: Request) {
  const text = await request.text()
  if (text.length > MAX_BODY) {
    return null
  }
  try {
    return popupEventOf(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

/**
 * `POST /api/popups/:id/events` (adr/0080 §7): a pop-up's counter, sent
 * by the layout's host without waiting (a beacon), passed on to the
 * backend with the visitor's address for its limit and nothing about the
 * visitor. Always the same 204, counted or not: the browser has nothing
 * to do with the answer, and it says nothing about which ids exist.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const id = popupIdOf((await params).id)
  if (id === null || !fromOwnPage(request)) {
    return DONE()
  }
  const type = await eventOf(request)
  if (type === null) {
    return DONE()
  }
  try {
    await storePublicPost(`/store/popups/${id}/events`, { type })
  } catch {
    // A count lost (the flag off, the limit, the backend away) is nobody's problem
  }
  return DONE()
}
