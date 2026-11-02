import { emailLinkUrl, storefrontLinkTarget } from "../links"

const TOKEN = "Zx_9-".repeat(8) + "abc"

/** adr/0038 Ek 2026-11-02: a message's token link opens the shop's own page once it has a host. */
describe("emailLinkUrl", () => {
  it("leads to the storefront's page when the shop has a host", () => {
    expect(emailLinkUrl("unsubscribe", "a.b", "https://magaza.example", null)).toBe(
      "https://magaza.example/abonelik/cik?t=a.b"
    )
    expect(emailLinkUrl("consent", TOKEN, "https://magaza.example/", "https://api.example")).toBe(
      `https://magaza.example/abonelik/onay?t=${TOKEN}`
    )
    expect(emailLinkUrl("stock_alert", TOKEN, "https://magaza.example", null)).toBe(
      `https://magaza.example/stok-bildirimi/onay?t=${TOKEN}`
    )
  })

  it("falls back to the backend's own page, and to none without either address", () => {
    expect(emailLinkUrl("consent", TOKEN, null, "https://api.magaza.example/")).toBe(
      `https://api.magaza.example/consents/confirm?t=${TOKEN}`
    )
    expect(emailLinkUrl("stock_alert", TOKEN, null, "https://api.magaza.example")).toBe(
      `https://api.magaza.example/stock-alerts/confirm?t=${TOKEN}`
    )
    expect(emailLinkUrl("unsubscribe", TOKEN, null, null)).toBeNull()
  })

  it("encodes the token as a query value", () => {
    expect(emailLinkUrl("consent", "a b&c", "https://magaza.example", null)).toBe(
      "https://magaza.example/abonelik/onay?t=a+b%26c"
    )
  })
})

describe("storefrontLinkTarget", () => {
  it("carries a token of our shape over to the shop's own host", () => {
    expect(
      storefrontLinkTarget("unsubscribe", `${"a".repeat(64)}.x`, "https://magaza.example")
    ).toBe(`https://magaza.example/abonelik/cik?t=${"a".repeat(64)}.x`)
  })

  it("carries nothing else: the page says a broken link is broken", () => {
    for (const junk of [
      undefined,
      ["a", "b"],
      "",
      "a".repeat(201),
      "<script>",
      "x\r\nSet-Cookie: a",
    ]) {
      expect(storefrontLinkTarget("consent", junk, "https://magaza.example")).toBe(
        "https://magaza.example/abonelik/onay"
      )
    }
  })
})
