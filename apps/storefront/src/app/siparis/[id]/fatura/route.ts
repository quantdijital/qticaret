import { storefrontEnv } from "@/lib/env"
import { storeUrl } from "@/lib/store-api/core"
import { publishableKey } from "@/lib/store-api/publishable-key"
import { sessionToken } from "@/lib/account/session"
import { orderInvoice } from "@/lib/orders/order"
import { signedVisitorHeaders, visitorIp } from "@/lib/store-api/visitor"

const ORDER_ID = /^order_[0-9A-Za-z]{10,64}$/
const TOKEN = /^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/

/**
 * `inline` with the file's name twice (RFC 6266): a plain ASCII one any
 * browser reads, every other character `_`, and the whole name in UTF-8
 * (`filename*`). The invoice number is the provider's text: a quote or a
 * line break in it never breaks the header.
 */
function inlineDisposition(name: string): string {
  const ascii = name.replace(/[^A-Za-z0-9._-]/g, "_")
  let encoded: string
  try {
    encoded = encodeURIComponent(name).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    )
  } catch {
    // A lone surrogate has no UTF-8: the ASCII name alone
    return `inline; filename="${ascii}"`
  }
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

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
    // A redirect is not followed with the session: it fails below as any other non-2xx
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  })
  if (!answer.ok || !answer.body) {
    return new Response(null, { status: answer.status === 404 ? 404 : 502 })
  }
  return new Response(answer.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": inlineDisposition(`fatura-${invoice.number ?? invoice.id}.pdf`),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
