import { afterEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

vi.mock("../../env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("../publishable-key", () => ({ publishableKey: () => Promise.resolve("pk_test1234") }))

const { storeRequest } = await import("../core")

const answer = (body: string, status: number, type = "application/json") => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(body, { status, headers: { "content-type": type } })))
  )
}

describe("storeRequest's failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("throws the backend's message key from its JSON", async () => {
    answer(JSON.stringify({ message: "addons.charset", request_id: "req_12345678" }), 400)
    await expect(
      storeRequest("/store/carts/cart_1/line-items/cali_1/addons", { visitorIp: null })
    ).rejects.toMatchObject({
      status: 400,
      messageKey: "addons.charset",
      requestId: "req_12345678",
    })
  })

  it("reads a page for an answer as a 404 without a key: a feature that is off (adr/0012)", async () => {
    answer("<!DOCTYPE html>\n<pre>Cannot GET /store/products/prod_1/addons</pre>", 404, "text/html")
    const failure: unknown = await storeRequest("/store/products/prod_1/addons", {
      visitorIp: null,
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(StoreApiError)
    expect(failure).toMatchObject({ status: 404, messageKey: null })
  })

  it("still refuses a success that is not JSON", async () => {
    answer("<html></html>", 200, "text/html")
    await expect(storeRequest("/store/storefront", { visitorIp: null })).rejects.toThrow(
      SyntaxError
    )
  })
})
