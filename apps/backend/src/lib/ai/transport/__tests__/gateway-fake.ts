import {
  MemoryNonceStore,
  privateKeyFromSeed,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { AI_CALL_RESPONSE_HEADERS } from "@qticaret/types/control-plane"
import { FIXED_NOW, TENANT_ID, TEST_ONLY_TENANT_SEED } from "@qticaret/types/control-plane/testing"
import type { AiGatewayEndpoint } from "../../../control-plane/ai-gateway"

/** A stand-in control plane for the platform transport's tests: records and answers. */

export const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
export const ENDPOINT: AiGatewayEndpoint = {
  url: "http://control-plane.internal:9000",
  tenantId: TENANT_ID,
  signer: shop,
}
export const OPERATION = "0b6f3f5e-8a7d-4c1e-9b2a-3c4d5e6f7a8b"
export const TERMS = {
  task: "seo_title",
  capability: "text",
  service: "deepseek",
  operation: OPERATION,
}
export const now = () => FIXED_NOW

export interface Received {
  url: string
  init: RequestInit
}

/** The gateway's headers on an answer it passed on. */
export const charged = (credits: number, balance: number): Record<string, string> => ({
  [AI_CALL_RESPONSE_HEADERS.charged]: String(credits),
  [AI_CALL_RESPONSE_HEADERS.balance]: String(balance),
})

export const refusal = (code: string, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ qt_ai_gateway: { code } }), {
    status: 402,
    headers: {
      "content-type": "application/json",
      [AI_CALL_RESPONSE_HEADERS.refusal]: code,
      ...extra,
    },
  })

export function gateway(answer: () => Response | Promise<Response>) {
  const received: Received[] = []
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    received.push({ url, init })
    return answer()
  }
  return { fetch, received }
}

/** A fetch that answers only when its signal gives up: never, until then. */
export const hanging = (_url: string, init: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"))
    })
  })

/** The bytes as they would leave: a string as UTF-8. */
export const bytesOf = (body: RequestInit["body"]): Buffer =>
  typeof body === "string" ? Buffer.from(body) : Buffer.from(body as Uint8Array)

/** Whether the request carries this shop's valid signature over this path and these bytes. */
export async function signedBy(received: Received, path: string): Promise<boolean> {
  const verified = await verifySignedRequest(
    {
      method: "POST",
      path,
      headers: received.init.headers as Record<string, string>,
      body: bytesOf(received.init.body),
    },
    {
      publicKey: (kid, tenant) =>
        kid === shop.kid && tenant === TENANT_ID ? shop.privateKey : undefined,
      nonces: new MemoryNonceStore(),
      now: () => FIXED_NOW,
    }
  )
  return verified.ok
}
