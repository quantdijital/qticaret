import type { RefreshScope } from "./contract"
import type { AddressBudget, NonceLedger } from "./verify"
import { verifyRefresh } from "./verify"

/** The body's limit (adr/0048 Ek 2026-11-03): six scopes, a time and a nonce fit well inside. */
export const MAX_BODY_BYTES = 1024

export interface RefreshDeps {
  /** `STOREFRONT_IP_SECRET`; without it nothing could be signed: 404. */
  secret: string | undefined
  nowMs: number
  /** The sender's address, for the budget counted before the signature. */
  address: string | null
  nonces: NonceLedger
  budget: AddressBudget
  /** Drops what the scopes touched. */
  forget: (scopes: RefreshScope[]) => void
}

/** No body, never stored: a "no" says nothing of why. */
const answer = (status: number) =>
  new Response(null, { status, headers: { "cache-control": "no-store" } })

/** The body as text, or null past the limit (said or found while reading). */
async function bodyText(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(declared) || declared > max) {
    return null
  }
  if (!request.body) {
    return ""
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * `POST /api/yenile` (adr/0048 Ek 2026-11-03): the address's budget
 * first, then the secret, the body's size, the signal's checks; 204 once
 * the scopes' caches are dropped, 401 for any miss, 404 without a secret.
 */
export async function handleRefresh(request: Request, deps: RefreshDeps): Promise<Response> {
  if (!deps.budget.take(deps.address ?? "unknown", deps.nowMs)) {
    return answer(401)
  }
  if (!deps.secret) {
    return answer(404)
  }
  const text = await bodyText(request, MAX_BODY_BYTES)
  if (text === null) {
    return answer(401)
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return answer(401)
  }
  const scopes = verifyRefresh(
    {
      time: request.headers.get("x-qt-refresh-time"),
      signature: request.headers.get("x-qt-refresh-signature"),
      body,
    },
    deps.secret,
    deps.nowMs,
    deps.nonces
  )
  if (!scopes) {
    return answer(401)
  }
  deps.forget(scopes)
  return answer(204)
}
