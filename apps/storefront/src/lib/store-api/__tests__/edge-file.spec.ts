import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("../publishable-key", () => ({ publishableKey: () => Promise.resolve("pk_test1234") }))

const { backendFileResponse } = await import("../edge")

const backend = (response: Response) => {
  const fetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response)
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

/** robots.txt, the sitemaps, security.txt: passed through from the backend (docs/13). */
describe("backendFileResponse", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("passes the file through, asked without following a redirect", async () => {
    const fetch = backend(
      new Response("User-agent: *\n", { status: 200, headers: { "content-type": "text/plain" } })
    )
    const answer = await backendFileResponse("/store/seo/robots", null)
    expect(answer.status).toBe(200)
    expect(await answer.text()).toBe("User-agent: *\n")
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe("http://backend.test/store/seo/robots")
    expect(init?.redirect).toBe("manual")
  })

  it("answers a backend redirect as a failure, not the redirect's target", async () => {
    backend(
      new Response(null, { status: 301, headers: { location: "https://evil.example/robots" } })
    )
    const answer = await backendFileResponse("/store/seo/robots", null)
    expect(answer.status).toBe(502)
    expect(answer.headers.get("location")).toBeNull()
    expect(await answer.text()).toBe("Not found\n")
  })

  it("refuses a path off the backend's routes and asks nothing", async () => {
    const fetch = backend(new Response("x"))
    await expect(backendFileResponse("//evil.example/robots", null)).rejects.toThrow(
      "Store API path refused"
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
