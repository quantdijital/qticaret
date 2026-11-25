import {
  MemoryNonceStore,
  privateKeyFromSeed,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import { AI_CREDITS_PATHS } from "@qticaret/types/control-plane"
import type { AiCreditOrder } from "@qticaret/types/control-plane"
import { FIXED_NOW, TENANT_ID, TEST_ONLY_TENANT_SEED } from "@qticaret/types/control-plane/testing"
import { requestAiCreditOrder } from "../ai-credit-order"

/** adr/0085 K11 (P4b-2): a top-up request, signed, its body the pack's id and who asked. */

const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
const ENDPOINT = { url: "http://control-plane.internal:9000", tenantId: TENANT_ID, signer: shop }

const ORDER: AiCreditOrder = {
  id: "aicord_01",
  pack: { id: "pack-500", name: "500 kredi", credits: 500, amount: 25_000, currency: "TRY" },
  status: "pending",
  requested_at: "2026-11-25T10:00:00.000Z",
}

function controlPlane(answer: () => Response | Promise<Response>) {
  const received: { url: string; init: RequestInit }[] = []
  const fetch = async (url: string, init: RequestInit) => {
    received.push({ url, init })
    return answer()
  }
  return { fetch, received }
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status })
const now = () => FIXED_NOW
const ask = { packId: "pack-500", requestedBy: "user_01ABC" }

describe("a top-up request to the control plane", () => {
  it("sends the pack's id and the user's id alone, signed, and reads the order", async () => {
    const { fetch, received } = controlPlane(() => json({ order: ORDER }, 201))
    await expect(requestAiCreditOrder(ask, { endpoint: ENDPOINT, fetch, now })).resolves.toEqual({
      kind: "ordered",
      order: ORDER,
    })
    expect(received).toHaveLength(1)
    const [sent] = received
    if (sent === undefined) {
      throw new Error("nothing was sent")
    }
    expect(sent.url).toBe(`${ENDPOINT.url}${AI_CREDITS_PATHS.orders}`)
    expect(sent.init).toMatchObject({ method: "POST", redirect: "error" })
    const body = sent.init.body
    if (typeof body !== "string") {
      throw new Error("the body is not text")
    }
    // Never a price, a credit count or a currency: the platform's pack says them
    expect(JSON.parse(body)).toEqual({ pack_id: "pack-500", requested_by: "user_01ABC" })
    const verified = await verifySignedRequest(
      {
        method: "POST",
        path: AI_CREDITS_PATHS.orders,
        headers: sent.init.headers as Record<string, string>,
        body: Buffer.from(body),
      },
      { publicKey: () => shop.privateKey, nonces: new MemoryNonceStore(), now }
    )
    expect(verified).toMatchObject({ ok: true, tenantId: TENANT_ID })
  })

  it("tells the control plane's two conflicts apart by their words", async () => {
    const open = controlPlane(() =>
      json({ type: "conflict", message: "cp.ai_credit_order_pending" }, 409)
    )
    await expect(
      requestAiCreditOrder(ask, { endpoint: ENDPOINT, fetch: open.fetch, now })
    ).resolves.toEqual({ kind: "open" })
    const unknown = controlPlane(() =>
      json({ type: "not_found", message: "ai_credits.pack_unknown" }, 404)
    )
    await expect(
      requestAiCreditOrder(ask, { endpoint: ENDPOINT, fetch: unknown.fetch, now })
    ).resolves.toEqual({ kind: "pack_unknown" })
  })

  it.each([
    ["a route not there", () => json({ message: "Not found" }, 404), "http_404"],
    [
      "another conflict",
      () => json({ message: "cp.ai_credit_grant_ref_conflict" }, 409),
      "http_409",
    ],
    ["a refused signature", () => json({ message: "signature.invalid" }, 401), "http_401"],
    ["credits not available", () => json({ message: "ai_credits.unavailable" }, 400), "http_400"],
    ["a failure", () => json({}, 500), "http_500"],
    ["an order of another shape", () => json({ order: { id: "x" } }, 201), "answer_shape"],
    ["a page not JSON", () => new Response("<html>", { status: 201 }), "answer_not_json"],
    [
      "a too large answer",
      () => new Response("x".repeat(9000), { status: 201 }),
      "answer_too_large",
    ],
    ["no answer", () => Promise.reject(new TypeError("fetch failed")), "unreachable"],
  ] as const)("reads %s as unavailable", async (_name, answer, code) => {
    const { fetch } = controlPlane(answer)
    await expect(requestAiCreditOrder(ask, { endpoint: ENDPOINT, fetch, now })).resolves.toEqual({
      kind: "unavailable",
      code,
    })
  })

  it("asks nobody unmanaged, nor with an id that is no user's", async () => {
    const { fetch, received } = controlPlane(() => json({ order: ORDER }, 201))
    await expect(requestAiCreditOrder(ask, { endpoint: null, fetch, now })).resolves.toEqual({
      kind: "unavailable",
      code: "control_plane_not_configured",
    })
    await expect(
      requestAiCreditOrder(
        { ...ask, requestedBy: "someone@example.com" },
        { endpoint: ENDPOINT, fetch, now }
      )
    ).resolves.toEqual({ kind: "unavailable", code: "request_invalid" })
    expect(received).toHaveLength(0)
  })
})
