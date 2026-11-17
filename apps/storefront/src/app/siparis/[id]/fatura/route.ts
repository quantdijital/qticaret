import { storefrontEnv } from "@/lib/env"
import { storeUrl } from "@/lib/store-api/core"
import { publishableKey } from "@/lib/store-api/publishable-key"
import { sessionToken } from "@/lib/account/session"
import { orderInvoice } from "@/lib/orders/order"
import { signedVisitorHeaders, visitorIp } from "@/lib/store-api/visitor"

const ORDER_ID = /^order_[0-9A-Za-z]{10,64}$/
const TOKEN = /^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/

/**
 * `/siparis/:id/fatura` (F8): the order's invoice PDF, passed through from
 * the backend with the shopper's key or session; never cached.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const raw = new URL(request.url).searchParams.get("token")
  const token = raw && TOKEN.test(raw) ? raw : null
  if (!ORDER_ID.test(id)) {
    return new Response(null, { status: 404 })
  }
  const invoice = await orderInvoice(id, token)
  if (!invoice?.has_pdf) {
    return new Response(null, { status: 404 })
  }
  const env = storefrontEnv()
  const session = await sessionToken()
  const url = storeUrl(`/store/orders/${encodeURIComponent(id)}/invoice/pdf`, {
    invoice: invoice.id,
  })
  const answer = await fetch(url, {
    headers: {
      "x-publishable-api-key": await publishableKey(env),
      ...signedVisitorHeaders(
        env.STOREFRONT_IP_SECRET,
        visitorIp(request.headers, env.STOREFRONT_TRUSTED_PROXY_HOPS ?? 0)
      ),
      ...(token ? { "x-order-token": token } : {}),
      ...(session ? { authorization: `Bearer ${session}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if (!answer.ok || !answer.body) {
    return new Response(null, { status: answer.status === 404 ? 404 : 502 })
  }
  return new Response(answer.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="fatura-${invoice.number ?? invoice.id}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
