import { describe, expect, it, vi } from "vitest"

vi.mock("../../env", () => ({ storefrontEnv: () => ({ STOREFRONT_ORIGIN: "https://shop.test" }) }))

const { breakOut, framed } = await import("../return")

const framedRequest = (url: string, nonce = "n0nce") =>
  new Request(url, { headers: { "sec-fetch-dest": "iframe", "x-nonce": nonce } })

const bodyOf = async (response: Response) => await response.text()

/**
 * The provider's return loaded inside its own frame lifts itself to the
 * whole window (D7). The page is hand-built HTML, so every piece is escaped
 * for where it lands.
 */
describe("breakOut", () => {
  it("is used only for a load inside a frame", () => {
    expect(framed(framedRequest("https://shop.test/odeme/sonuc"))).toBe(true)
    expect(framed(new Request("https://shop.test/odeme/sonuc"))).toBe(false)
  })

  it("sends the whole window to the same address, with the proxy's nonce", async () => {
    const response = breakOut(framedRequest("https://shop.test/odeme/sonuc?a=1&b=2"), "Devam et")
    const html = await bodyOf(response)

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(html).toContain(
      `<script nonce="n0nce">window.top.location.href="/odeme/sonuc?a=1\\u0026b=2"</script>`
    )
    expect(html).toContain(`<a href="/odeme/sonuc?a=1&amp;b=2" target="_top">Devam et</a>`)
  })

  it("keeps markup out of the label, the nonce and the address", async () => {
    const html = await bodyOf(
      breakOut(
        framedRequest(
          `https://shop.test/odeme/sonuc?x=</script><img src=x onerror=alert(1)>"'`,
          `"><script>`
        ),
        `</title><script>alert(1)</script>`
      )
    )

    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script>alert")
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).toContain("&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).toContain(`nonce="&quot;&gt;&lt;script&gt;"`)
  })

  it("never sends the window to another site", async () => {
    const html = await bodyOf(
      breakOut(framedRequest("https://shop.test//evil.example/x"), "Devam et")
    )

    expect(html).toContain(`window.top.location.href="/"`)
    expect(html).toContain(`<a href="/" target="_top">`)
  })
})
