import { afterEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

vi.mock("../../env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("../publishable-key", () => ({ publishableKey: () => Promise.resolve("pk_test1234") }))

const { StorePathError, storeRequest, storeUrl } = await import("../core")

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

describe("storeRequest stays on the backend", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const sent = () => {
    const fetch = vi.fn<(url: URL) => Promise<Response>>(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    )
    vi.stubGlobal("fetch", fetch)
    return fetch
  }

  it.each([
    ["an absolute URL", "https://evil.example/store/products"],
    ["an absolute URL on the backend's own scheme", "http://evil.example/store/products"],
    ["a protocol-relative URL", "//evil.example/store/products"],
    ["a backslash after the slash", "/\\evil.example/store/products"],
    ["two backslashes", "\\\\evil.example/store/products"],
    ["a backslash further in", "/store/..\\..\\admin/users"],
    ["a scheme", "javascript:alert(1)"],
    ["a scheme with no slashes", "http:evil.example/store/products"],
    ["a data URL", "data:text/plain,store"],
    ["an encoded double slash", "%2F%2Fevil.example/store/products"],
    ["an encoded double slash after one slash", "/%2F%2Fevil.example/store/products"],
    ["a tab the parser drops", "/\t/evil.example/store/products"],
    ["a newline the parser drops", "/\n/evil.example/store/products"],
    ["no leading slash", "store/products"],
    ["nothing", ""],
    ["a dot-dot walk out of the Store API", "/store/../admin/users"],
    ["an encoded dot-dot walk", "/store/%2e%2E/admin/users"],
    ["a dot-dot inside the Store API", "/store/carts/../customers/me"],
    ["a prefix the storefront does not use", "/admin/users"],
    ["a prefix that only starts the same", "/storefront/x"],
    ["the backend's dev key route", "/dev/storefront-key"],
  ])("refuses %s and sends nothing", async (_name, path) => {
    const fetch = sent()
    await expect(storeRequest(path, { visitorIp: null, method: "POST", body: {} })).rejects.toThrow(
      StorePathError
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refuses a path that is not a string", async () => {
    const fetch = sent()
    await expect(
      storeRequest({ toString: () => "/store/x" } as unknown as string, { visitorIp: null })
    ).rejects.toThrow(StorePathError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["//evil.example/x?token=secret-token-value", "/admin/x?token=secret-token-value"])(
    "never names the refused path %#",
    (path) => {
      const failure = (() => {
        try {
          storeUrl(path)
          return null
        } catch (error) {
          return error as Error
        }
      })()
      expect(failure).toBeInstanceOf(StorePathError)
      expect(failure?.message).not.toContain("secret-token-value")
      expect(failure?.message).not.toContain("/x")
    }
  )

  it("sends a Store API path with its own query and the request's", async () => {
    const fetch = sent()
    await storeRequest("/store/products?limit=2", { visitorIp: null, query: { offset: 4 } })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "http://backend.test/store/products?limit=2&offset=4"
    )
  })

  it("sends the customer's sign-in routes", async () => {
    const fetch = sent()
    await storeRequest("/auth/token/refresh", { visitorIp: null, method: "POST" })
    expect(String(fetch.mock.calls[0]?.[0])).toBe("http://backend.test/auth/token/refresh")
  })

  it("keeps an encoded slug with ../ and ? inside its own segment", async () => {
    const fetch = sent()
    const slug = "../../admin/users?all=1#x"
    await storeRequest(`/store/products/${encodeURIComponent(slug)}/reviews`, { visitorIp: null })
    const url = fetch.mock.calls[0]?.[0]
    expect(url?.origin).toBe("http://backend.test")
    expect(url?.pathname).toBe("/store/products/..%2F..%2Fadmin%2Fusers%3Fall%3D1%23x/reviews")
    expect(url?.search).toBe("")
  })

  it("refuses an id that is only dots, which encoding leaves as it is", async () => {
    const fetch = sent()
    await expect(
      storeRequest(`/store/carts/${encodeURIComponent("..")}/line-items`, { visitorIp: null })
    ).rejects.toThrow(StorePathError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
